import Contact from "../models/Contact";
import LidMapping from "../models/LidMapping";
import Ticket from "../models/Ticket";
import { Op } from "sequelize";
import logger from "../utils/logger";

/**
 * Job: ReconcileLid - Reconcilia contatos PENDING_ (LIDs não resolvidos)
 * 
 * Responsabilidades:
 * - Encontrar contatos PENDING_ da mesma empresa que correspondem ao LID
 * - Mesclar ou atualizar contatos quando mapeamento é descoberto
 * - Resolver situação "PENDING_" para número real
 * 
 * Trigger:
 * - Evento: LidMapping created (novo mapeamento LID→PN descoberto)
 * - Timing: Imediato
 * 
 * NOTA: Este job substitui o reconcileAllCompanies (5min polling)
 * Versão event-driven: só executa quando novo mapeamento é salvo
 */
export default {
  key: `${process.env.DB_NAME}-ReconcileLid`,

  async handle({ data }: { data: any }) {
    const { 
      lid,
      phoneNumber,
      companyId,
      contactId // ID do contato que foi resolvido
    } = data || {};

    if (!lid || !phoneNumber || !companyId) {
      throw new Error("[ReconcileLidJob] lid, phoneNumber e companyId são obrigatórios");
    }

    logger.info(`[ReconcileLidJob] Iniciando reconciliação de LID`, {
      lid,
      phoneNumber,
      companyId,
      contactId,
    });

    try {
      // Buscar contatos PENDING_ na mesma empresa que podem ser este LID
      const pendingContacts = await Contact.findAll({
        where: {
          companyId,
          [Op.or]: [
            { number: { [Op.like]: `PENDING_%` } },
            { remoteJid: lid },
            { lidJid: lid }
          ]
        },
        attributes: ["id", "name", "number", "remoteJid", "lidJid"]
      });

      if (pendingContacts.length === 0) {
        logger.info(`[ReconcileLidJob] Nenhum contato PENDENTE encontrado para reconciliação`, {
          lid,
          companyId,
        });
        return {
          success: true,
          reconciled: 0,
          message: "No pending contacts found",
        };
      }

      logger.info(`[ReconcileLidJob] ${pendingContacts.length} contato(s) PENDENTE(s) encontrado(s)`, {
        lid,
        companyId,
        pendingIds: pendingContacts.map((c: any) => c.id),
      });

      let reconciled = 0;
      let errors = 0;

      for (const pending of pendingContacts) {
        try {
          // Verificar se é o mesmo contato ou se precisa mesclar
          if (contactId && pending.id === contactId) {
            // É o mesmo contato - só atualizar com número real
            await pending.update({
              number: phoneNumber,
              // Limpar flags de pending
            });
            
            logger.info(`[ReconcileLidJob] Contato ${pending.id} atualizado com número real`, {
              oldNumber: pending.number,
              newNumber: phoneNumber,
            });
            
            reconciled++;
            continue;
          }

          // Verificar se existe contato com este número na empresa
          const existingContact = await Contact.findOne({
            where: {
              companyId,
              number: phoneNumber,
              isGroup: false,
              id: { [Op.ne]: pending.id } // Não é o próprio pending
            }
          });

          if (existingContact) {
            // Existe contato duplicado - mesclar
            logger.info(`[ReconcileLidJob] Mesclando contato ${pending.id} → ${existingContact.id}`, {
              pendingNumber: pending.number,
              realNumber: phoneNumber,
            });

            // Transferir tickets do contato pending para o existente
            const ticketsTransferred = await Ticket.update(
              { contactId: existingContact.id },
              { where: { contactId: pending.id } }
            );

            // Transferir mensagens do contato pending para o existente
            const Message = require("../models/Message").default;
            const messagesTransferred = await Message.update(
              { contactId: existingContact.id },
              { where: { contactId: pending.id } }
            );

            logger.info(`[ReconcileLidJob] Merge completo: ${ticketsTransferred[0]} tickets, ${messagesTransferred[0]} mensagens transferidas`);

            // Deletar contato pending após merge
            await pending.destroy();

            reconciled++;
          } else {
            // Não existe duplicata - atualizar número
            await pending.update({
              number: phoneNumber,
            });

            logger.info(`[ReconcileLidJob] Contato ${pending.id} resolvido`, {
              oldNumber: pending.number,
              newNumber: phoneNumber,
            });

            reconciled++;
          }

        } catch (contactError: any) {
          logger.error(`[ReconcileLidJob] Erro ao reconciliar contato ${pending.id}`, {
            error: contactError.message,
            lid,
            phoneNumber,
          });
          errors++;
        }
      }

      logger.info(`[ReconcileLidJob] Reconciliação finalizada`, {
        lid,
        companyId,
        totalPending: pendingContacts.length,
        reconciled,
        errors,
      });

      return {
        success: true,
        lid,
        phoneNumber,
        companyId,
        totalPending: pendingContacts.length,
        reconciled,
        errors,
      };

    } catch (error: any) {
      logger.error(`[ReconcileLidJob] Erro geral na reconciliação`, {
        lid,
        phoneNumber,
        companyId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
};
