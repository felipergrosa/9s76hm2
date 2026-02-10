import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import ContactTag from "../../models/ContactTag";
import sequelize from "../../database";
import logger from "../../utils/logger";
import { getIO } from "../../libs/socket";

/**
 * Serviço para mesclagem de contatos duplicados
 * 
 * Usado principalmente para mesclar contatos LID (temporários) com contatos reais
 * quando o mapeamento LID → PN é descoberto.
 */

interface MergeResult {
  success: boolean;
  ticketsMoved: number;
  messagesMoved: number;
  tagsCopied: number;
  error?: string;
}

/**
 * Mescla um contato LID (temporário) com um contato real
 * 
 * Transfere todos os tickets, mensagens e tags do contato LID para o contato real,
 * e remove o contato LID após a mesclagem.
 * 
 * @param lidContactId ID do contato LID (será removido)
 * @param realContactId ID do contato real (receberá os dados)
 * @param companyId ID da empresa
 * @returns Resultado da mesclagem
 */
const mergeContacts = async (
  lidContactId: number,
  realContactId: number,
  companyId: number
): Promise<MergeResult> => {
  const transaction = await sequelize.transaction();

  try {
    // Validar que os contatos existem
    const lidContact = await Contact.findOne({
      where: { id: lidContactId, companyId },
      transaction
    });

    const realContact = await Contact.findOne({
      where: { id: realContactId, companyId },
      transaction
    });

    if (!lidContact) {
      await transaction.rollback();
      return { success: false, ticketsMoved: 0, messagesMoved: 0, tagsCopied: 0, error: "Contato LID não encontrado" };
    }

    if (!realContact) {
      await transaction.rollback();
      return { success: false, ticketsMoved: 0, messagesMoved: 0, tagsCopied: 0, error: "Contato real não encontrado" };
    }

    // Não mesclar grupos
    if (lidContact.isGroup || realContact.isGroup) {
      await transaction.rollback();
      return { success: false, ticketsMoved: 0, messagesMoved: 0, tagsCopied: 0, error: "Não é permitido mesclar grupos" };
    }

    logger.info("[ContactMergeService] Iniciando mesclagem", {
      lidContactId,
      lidContactName: lidContact.name,
      lidContactNumber: lidContact.number,
      realContactId,
      realContactName: realContact.name,
      realContactNumber: realContact.number,
      companyId
    });

    // 1. Transferir tickets
    const [ticketsMoved] = await Ticket.update(
      { contactId: realContactId },
      { where: { contactId: lidContactId }, transaction }
    );

    // 2. Transferir mensagens
    const [messagesMoved] = await Message.update(
      { contactId: realContactId },
      { where: { contactId: lidContactId }, transaction }
    );

    // 3. Copiar tags (sem duplicar)
    const lidTags = await ContactTag.findAll({
      where: { contactId: lidContactId },
      transaction
    });

    let tagsCopied = 0;
    for (const tag of lidTags) {
      try {
        const [, created] = await ContactTag.findOrCreate({
          where: { contactId: realContactId, tagId: tag.tagId },
          defaults: {
            contactId: realContactId,
            tagId: tag.tagId
          } as any,
          transaction
        });
        if (created) tagsCopied++;
      } catch (e) {
        // Tag já existe, ignorar
      }
    }

    // 4. Atualizar contato real com informações do LID (se úteis)
    const updateData: any = {};

    // Salvar o LID no contato real para referência futura
    if (lidContact.remoteJid && lidContact.remoteJid.includes("@lid")) {
      // Podemos adicionar um campo lidJid no futuro
      // Por enquanto, apenas logamos
      logger.info("[ContactMergeService] LID original salvo para referência", {
        realContactId,
        lidJid: lidContact.remoteJid
      });
    }

    // Se o contato real não tem nome e o LID tem, copiar
    if (!realContact.name && lidContact.name) {
      updateData.name = lidContact.name;
    }

    // Se o contato real não tem profilePicUrl e o LID tem, copiar
    if (!realContact.profilePicUrl && lidContact.profilePicUrl) {
      updateData.profilePicUrl = lidContact.profilePicUrl;
    }

    if (Object.keys(updateData).length > 0) {
      await realContact.update(updateData, { transaction });
    }

    // 5. Remover tags do contato LID
    await ContactTag.destroy({
      where: { contactId: lidContactId },
      transaction
    });

    // 6. Remover contato LID
    await Contact.destroy({
      where: { id: lidContactId },
      transaction
    });

    // Commit da transação
    await transaction.commit();

    logger.info("[ContactMergeService] Mesclagem concluída com sucesso", {
      lidContactId,
      realContactId,
      ticketsMoved,
      messagesMoved,
      tagsCopied
    });

    // Emitir evento via Socket.IO para atualizar frontend
    try {
      const io = getIO();
      io.of(`/workspace-${companyId}`)
        .emit(`company-${companyId}-contact`, {
          action: "delete",
          contactId: lidContactId
        });
      io.of(`/workspace-${companyId}`)
        .emit(`company-${companyId}-contact`, {
          action: "update",
          contact: realContact
        });
    } catch (e) {
      // Ignorar erros de socket
    }

    return {
      success: true,
      ticketsMoved,
      messagesMoved,
      tagsCopied
    };
  } catch (error: any) {
    await transaction.rollback();
    logger.error("[ContactMergeService] Erro na mesclagem", {
      lidContactId,
      realContactId,
      error: error?.message
    });
    return {
      success: false,
      ticketsMoved: 0,
      messagesMoved: 0,
      tagsCopied: 0,
      error: error?.message
    };
  }
};

/**
 * Encontra e mescla todos os contatos LID que têm um contato real correspondente
 * 
 * @param companyId ID da empresa
 * @returns Estatísticas da mesclagem em lote
 */
const mergeAllDuplicateLids = async (companyId: number): Promise<{
  total: number;
  merged: number;
  errors: number;
}> => {
  const { Op, fn, col, where: seqWhere } = require("sequelize");

  // Buscar todos os contatos LID (remoteJid @lid ou número PENDING_)
  const lidContacts = await Contact.findAll({
    where: {
      companyId,
      isGroup: false,
      [Op.or]: [
        { remoteJid: { [Op.like]: "%@lid" } },
        { number: { [Op.like]: "PENDING_%" } }
      ]
    }
  });

  let merged = 0;
  let errors = 0;

  for (const lidContact of lidContacts) {
    try {
      // Buscar contato real com mesmo nome (que não seja outro LID)
      const realContact = await Contact.findOne({
        where: {
          companyId,
          isGroup: false,
          id: { [Op.ne]: lidContact.id },
          name: lidContact.name,
          remoteJid: { [Op.like]: "%@s.whatsapp.net" },
          number: { [Op.notLike]: "PENDING_%" }
        }
      });

      if (realContact) {
        const result = await mergeContacts(lidContact.id, realContact.id, companyId);
        if (result.success) {
          merged++;
        } else {
          errors++;
        }
      }
    } catch (e: any) {
      logger.warn("[ContactMergeService] Erro ao processar LID em lote", {
        lidContactId: lidContact.id,
        error: e?.message
      });
      errors++;
    }
  }

  logger.info("[ContactMergeService] Mesclagem em lote concluída", {
    companyId,
    total: lidContacts.length,
    merged,
    errors
  });

  return { total: lidContacts.length, merged, errors };
};

export default {
  mergeContacts,
  mergeAllDuplicateLids
};
