import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import { Op } from "sequelize";
import logger from "../../utils/logger";
import { getIO } from "../../libs/socket";

interface MergeContactsData {
  primaryContactId: number;  // Contato principal (será mantido)
  secondaryContactId: number; // Contato a ser mesclado (será removido)
  companyId: number;
}

/**
 * Serviço para mesclar dois contatos duplicados.
 * Move todos os tickets e mensagens do contato secundário para o primário,
 * e depois remove o contato secundário.
 */
const MergeContactsService = async ({
  primaryContactId,
  secondaryContactId,
  companyId
}: MergeContactsData): Promise<{ success: boolean; message: string; mergedTickets?: number; mergedMessages?: number }> => {
  try {
    // Buscar ambos os contatos
    const primaryContact = await Contact.findOne({
      where: { id: primaryContactId, companyId }
    });

    const secondaryContact = await Contact.findOne({
      where: { id: secondaryContactId, companyId }
    });

    if (!primaryContact) {
      return { success: false, message: `Contato primário ${primaryContactId} não encontrado` };
    }

    if (!secondaryContact) {
      return { success: false, message: `Contato secundário ${secondaryContactId} não encontrado` };
    }

    if (primaryContactId === secondaryContactId) {
      return { success: false, message: "Os contatos primário e secundário são o mesmo" };
    }

    logger.info({
      message: "[MergeContacts] Iniciando mesclagem de contatos",
      primaryContactId,
      primaryName: primaryContact.name,
      primaryNumber: primaryContact.number,
      secondaryContactId,
      secondaryName: secondaryContact.name,
      secondaryNumber: secondaryContact.number,
      companyId
    });

    // 1. Mover todos os tickets do contato secundário para o primário
    const ticketsUpdated = await Ticket.update(
      { contactId: primaryContactId },
      { where: { contactId: secondaryContactId, companyId } }
    );

    // 2. Mover todas as mensagens do contato secundário para o primário
    const messagesUpdated = await Message.update(
      { contactId: primaryContactId },
      { where: { contactId: secondaryContactId, companyId } }
    );

    // 3. Preservar informações do contato secundário que podem ser úteis
    // Se o primário não tem remoteJid do tipo LID, mas o secundário tem, preservar
    if (secondaryContact.remoteJid?.includes("@lid") && !primaryContact.remoteJid?.includes("@lid")) {
      // Armazenar o LID em um campo ou log para referência futura
      logger.info({
        message: "[MergeContacts] Preservando LID do contato secundário",
        lid: secondaryContact.remoteJid,
        primaryContactId
      });
    }

    // 4. Se o contato primário não tem nome válido, usar do secundário
    const primaryHasValidName = primaryContact.name && 
      primaryContact.name !== primaryContact.number &&
      !primaryContact.name.match(/^\d+$/);
    
    const secondaryHasValidName = secondaryContact.name && 
      secondaryContact.name !== secondaryContact.number &&
      !secondaryContact.name.match(/^\d+$/);

    if (!primaryHasValidName && secondaryHasValidName) {
      await primaryContact.update({ name: secondaryContact.name });
      logger.info({
        message: "[MergeContacts] Nome atualizado do contato secundário",
        newName: secondaryContact.name
      });
    }

    // 5. Se o contato primário não tem foto, usar do secundário
    if (!primaryContact.profilePicUrl && secondaryContact.profilePicUrl) {
      await primaryContact.update({ 
        profilePicUrl: secondaryContact.profilePicUrl,
        urlPicture: secondaryContact.urlPicture 
      });
    }

    // 6. Remover o contato secundário
    await secondaryContact.destroy();

    logger.info({
      message: "[MergeContacts] Mesclagem concluída com sucesso",
      primaryContactId,
      secondaryContactId,
      ticketsMoved: ticketsUpdated[0],
      messagesMoved: messagesUpdated[0]
    });

    // 7. Emitir evento de atualização
    const io = getIO();
    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-contact`, {
        action: "delete",
        contactId: secondaryContactId
      });

    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-contact`, {
        action: "update",
        contact: primaryContact
      });

    return {
      success: true,
      message: `Contatos mesclados com sucesso. ${ticketsUpdated[0]} tickets e ${messagesUpdated[0]} mensagens movidas.`,
      mergedTickets: ticketsUpdated[0],
      mergedMessages: messagesUpdated[0]
    };

  } catch (error) {
    logger.error({
      message: "[MergeContacts] Erro ao mesclar contatos",
      primaryContactId,
      secondaryContactId,
      error: error.message
    });

    return {
      success: false,
      message: `Erro ao mesclar contatos: ${error.message}`
    };
  }
};

/**
 * Busca contatos duplicados (LID vs número real) para uma empresa
 */
export const FindDuplicateLidContacts = async (companyId: number): Promise<Array<{
  lidContact: Contact;
  realContact: Contact;
}>> => {
  try {
    // Buscar contatos com remoteJid do tipo LID
    const lidContacts = await Contact.findAll({
      where: {
        companyId,
        remoteJid: { [Op.like]: "%@lid" },
        isGroup: false
      }
    });

    const duplicates: Array<{ lidContact: Contact; realContact: Contact }> = [];

    for (const lidContact of lidContacts) {
      // Para cada contato LID, buscar se existe contato com número real similar
      // Baseado no nome (pushName) que geralmente é o mesmo
      if (lidContact.name && !lidContact.name.match(/^\d+$/)) {
        const realContact = await Contact.findOne({
          where: {
            companyId,
            name: lidContact.name,
            id: { [Op.ne]: lidContact.id },
            remoteJid: { [Op.notLike]: "%@lid" },
            isGroup: false
          }
        });

        if (realContact) {
          duplicates.push({ lidContact, realContact });
        }
      }
    }

    return duplicates;
  } catch (error) {
    logger.error({
      message: "[FindDuplicateLidContacts] Erro ao buscar duplicados",
      companyId,
      error: error.message
    });
    return [];
  }
};

export default MergeContactsService;
