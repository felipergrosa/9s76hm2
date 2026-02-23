/**
 * ContactDeduplicationService - Deduplicação inteligente de contatos
 * 
 * Funcionalidades:
 * - Detecta duplicatas por número normalizado
 * - Detecta duplicatas por variações (551199... vs 1199...)
 * - Mescla contatos preservando dados
 * - Move tickets e mensagens para contato principal
 */

import { Op, Transaction, Sequelize } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import ContactNormalizer from "../../helpers/ContactNormalizer";
import logger from "../../utils/logger";
import sequelize from "../../database";

export interface DeduplicationResult {
  totalScanned: number;
  duplicateGroups: number;
  contactsMerged: number;
  contactsRemoved: number;
  errors: string[];
}

export interface MergeResult {
  success: boolean;
  primaryId: number;
  duplicateId: number;
  ticketsMoved: number;
  messagesMoved: number;
  error?: string;
}

class ContactDeduplicationService {
  /**
   * Encontra todos os grupos de duplicatas
   */
  async findDuplicates(companyId: number): Promise<Map<string, Contact[]>> {
    const contacts = await Contact.findAll({
      where: {
        companyId,
        isGroup: false // Apenas contatos individuais
      },
      order: [["createdAt", "ASC"]]
    });

    const normalizedMap = new Map<string, Contact[]>();

    for (const contact of contacts) {
      // Ignorar contatos PENDING_ (LID não resolvido)
      if (contact.number.startsWith("PENDING_")) continue;

      // Normalizar número
      const variations = ContactNormalizer.getVariations(contact.number);
      const canonical = variations.canonical;

      // Agrupar por número canônico
      if (!normalizedMap.has(canonical)) {
        normalizedMap.set(canonical, []);
      }
      normalizedMap.get(canonical)!.push(contact);
    }

    // Filtrar apenas grupos com duplicatas
    const duplicates = new Map<string, Contact[]>();
    for (const [canonical, contacts] of normalizedMap) {
      if (contacts.length > 1) {
        duplicates.set(canonical, contacts);
      }
    }

    return duplicates;
  }

  /**
   * Seleciona o contato principal entre duplicatas
   * Prioriza: 1) Tem nome real, 2) Mais tickets, 3) Mais antigo
   */
  async selectPrimaryContact(contacts: Contact[]): Promise<Contact> {
    // Buscar contagem de tickets para cada contato
    const contactIds = contacts.map(c => c.id);
    const ticketCounts = await Ticket.findAll({
      attributes: ["contactId", [Sequelize.fn("COUNT", Sequelize.col("id")), "count"]],
      where: { contactId: { [Op.in]: contactIds } },
      group: ["contactId"],
      raw: true
    });

    const ticketCountMap = new Map<number, number>();
    for (const row of ticketCounts as any[]) {
      ticketCountMap.set(row.contactId, parseInt(row.count) || 0);
    }

    // Ordenar por critérios
    const sorted = contacts.sort((a, b) => {
      // 1. Priorizar contato com nome real (não igual ao número)
      const aHasName = a.name && a.name !== a.number;
      const bHasName = b.name && b.name !== b.number;
      if (aHasName && !bHasName) return -1;
      if (!aHasName && bHasName) return 1;

      // 2. Priorizar contato com mais tickets
      const aTickets = ticketCountMap.get(a.id) || 0;
      const bTickets = ticketCountMap.get(b.id) || 0;
      if (aTickets !== bTickets) return bTickets - aTickets;

      // 3. Priorizar contato mais antigo
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return sorted[0];
  }

  /**
   * Mescla dois contatos (move tickets e mensagens)
   */
  async mergeContacts(
    primaryId: number,
    duplicateId: number,
    companyId: number,
    transaction?: Transaction
  ): Promise<MergeResult> {
    const t = transaction || await sequelize.transaction();

    try {
      const primary = await Contact.findByPk(primaryId, { transaction: t });
      const duplicate = await Contact.findByPk(duplicateId, { transaction: t });

      if (!primary || !duplicate) {
        if (!transaction) await t.rollback();
        return {
          success: false,
          primaryId,
          duplicateId,
          ticketsMoved: 0,
          messagesMoved: 0,
          error: "Contato não encontrado"
        };
      }

      logger.info({
        primaryId,
        duplicateId,
        primaryNumber: primary.number,
        duplicateNumber: duplicate.number
      }, "[Deduplication] Mesclando contatos...");

      // 1. Mover tickets
      const ticketsMoved = await Ticket.update(
        { contactId: primary.id },
        {
          where: { contactId: duplicate.id },
          transaction: t
        }
      );

      // 2. Mover mensagens
      const messagesMoved = await Message.update(
        { contactId: primary.id },
        {
          where: { contactId: duplicate.id },
          transaction: t
        }
      );

      // 3. Preservar dados do duplicado no primário (se vazios)
      const updates: any = {};
      
      if (!primary.name && duplicate.name && duplicate.name !== duplicate.number) {
        updates.name = duplicate.name;
      }
      if (!primary.pushName && duplicate.pushName) {
        updates.pushName = duplicate.pushName;
      }
      if (!primary.profilePicUrl && duplicate.profilePicUrl) {
        updates.profilePicUrl = duplicate.profilePicUrl;
      }
      if (!primary.email && duplicate.email) {
        updates.email = duplicate.email;
      }
      if (!primary.lidJid && duplicate.lidJid) {
        updates.lidJid = duplicate.lidJid;
      }

      if (Object.keys(updates).length > 0) {
        await primary.update(updates, { transaction: t });
      }

      // 4. Remover duplicata
      await duplicate.destroy({ transaction: t });

      if (!transaction) await t.commit();

      logger.info({
        primaryId,
        duplicateId,
        ticketsMoved: ticketsMoved[0],
        messagesMoved: messagesMoved[0]
      }, "[Deduplication] Contatos mesclados com sucesso");

      return {
        success: true,
        primaryId,
        duplicateId,
        ticketsMoved: ticketsMoved[0],
        messagesMoved: messagesMoved[0]
      };
    } catch (err: any) {
      if (!transaction) await t.rollback();
      
      logger.error({
        err: err?.message,
        primaryId,
        duplicateId
      }, "[Deduplication] Erro ao mesclar contatos");

      return {
        success: false,
        primaryId,
        duplicateId,
        ticketsMoved: 0,
        messagesMoved: 0,
        error: err?.message
      };
    }
  }

  /**
   * Executa deduplicação completa para uma empresa
   */
  async deduplicate(companyId: number): Promise<DeduplicationResult> {
    logger.info({ companyId }, "[Deduplication] Iniciando deduplicação...");

    const result: DeduplicationResult = {
      totalScanned: 0,
      duplicateGroups: 0,
      contactsMerged: 0,
      contactsRemoved: 0,
      errors: []
    };

    try {
      // 1. Encontrar duplicatas
      const duplicates = await this.findDuplicates(companyId);
      result.duplicateGroups = duplicates.size;

      logger.info({
        companyId,
        duplicateGroups: duplicates.size
      }, "[Deduplication] Grupos de duplicatas encontrados");

      // 2. Processar cada grupo
      for (const [canonical, contacts] of duplicates) {
        result.totalScanned += contacts.length;

        // Selecionar contato principal
        const primary = await this.selectPrimaryContact(contacts);
        const toMerge = contacts.filter(c => c.id !== primary.id);

        logger.info({
          canonical,
          primaryId: primary.id,
          primaryNumber: primary.number,
          duplicatesToMerge: toMerge.map(c => c.id)
        }, "[Deduplication] Processando grupo");

        // Mesclar cada duplicata
        for (const duplicate of toMerge) {
          const mergeResult = await this.mergeContacts(
            primary.id,
            duplicate.id,
            companyId
          );

          if (mergeResult.success) {
            result.contactsMerged++;
            result.contactsRemoved++;
          } else {
            result.errors.push(`Falha ao mesclar ${duplicate.id} → ${primary.id}: ${mergeResult.error}`);
          }
        }
      }

      logger.info({
        companyId,
        ...result
      }, "[Deduplication] Deduplicação concluída");

      return result;
    } catch (err: any) {
      logger.error({
        err: err?.message,
        companyId
      }, "[Deduplication] Erro na deduplicação");

      result.errors.push(err?.message);
      return result;
    }
  }

  /**
   * Normaliza todos os números de contatos de uma empresa
   */
  async normalizeAll(companyId: number): Promise<{
    total: number;
    normalized: number;
    errors: string[];
  }> {
    logger.info({ companyId }, "[Deduplication] Iniciando normalização...");

    const contacts = await Contact.findAll({
      where: { companyId, isGroup: false }
    });

    let normalized = 0;
    const errors: string[] = [];

    for (const contact of contacts) {
      try {
        // Ignorar PENDING_
        if (contact.number.startsWith("PENDING_")) continue;

        // Normalizar
        const norm = ContactNormalizer.normalize(
          contact.remoteJid || `${contact.number}@s.whatsapp.net`
        );

        // Atualizar se diferente
        if (contact.number !== norm.number || contact.canonicalNumber !== norm.canonicalNumber) {
          await contact.update({
            number: norm.number,
            canonicalNumber: norm.canonicalNumber,
            remoteJid: norm.jid
          });
          normalized++;

          logger.info({
            contactId: contact.id,
            oldNumber: contact.number,
            newNumber: norm.number
          }, "[Deduplication] Número normalizado");
        }
      } catch (err: any) {
        errors.push(`Contato ${contact.id}: ${err?.message}`);
      }
    }

    logger.info({
      companyId,
      total: contacts.length,
      normalized,
      errors: errors.length
    }, "[Deduplication] Normalização concluída");

    return {
      total: contacts.length,
      normalized,
      errors
    };
  }
}

export default new ContactDeduplicationService();
