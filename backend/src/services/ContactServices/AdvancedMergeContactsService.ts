import { Op, Transaction } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import ContactCustomField from "../../models/ContactCustomField";
import logger from "../../utils/logger";
import { getIO } from "../../libs/socket";

interface MergeContactsParams {
  companyId: number;
  primaryContactId: number;
  contactIdsToMerge: number[];
  preserveData?: {
    keepNewerCreatedAt?: boolean;
    keepNewerUpdatedAt?: boolean;
    mergeCustomFields?: boolean;
    keepAllTags?: boolean;
  };
}

interface MergeResult {
  success: boolean;
  mergedContact: any;
  mergedCount: number;
  ticketsTransferred: number;
  messagesTransferred: number;
  customFieldsMerged: number;
  errors: string[];
}

const AdvancedMergeContactsService = async ({
  companyId,
  primaryContactId,
  contactIdsToMerge,
  preserveData = {
    keepNewerCreatedAt: false,
    keepNewerUpdatedAt: true,
    mergeCustomFields: true,
    keepAllTags: true
  }
}: MergeContactsParams): Promise<MergeResult> => {
  const transaction = await Contact.sequelize?.transaction();
  
  try {
    logger.info(`Iniciando mesclagem de contatos - Principal: ${primaryContactId}, Mesclar: ${contactIdsToMerge.join(", ")}`);

    // Validar contato principal
    const primaryContact = await Contact.findOne({
      where: { id: primaryContactId, companyId },
      include: [
        {
          model: ContactCustomField,
          as: "extraInfo"
        }
      ],
      transaction
    });

    if (!primaryContact) {
      throw new Error("Contato principal não encontrado");
    }

    // Buscar contatos a serem mesclados
    const contactsToMerge = await Contact.findAll({
      where: {
        id: { 
          [Op.in]: contactIdsToMerge,
          [Op.ne]: primaryContactId
        },
        companyId
      },
      include: [
        {
          model: ContactCustomField,
          as: "extraInfo"
        }
      ],
      transaction
    });

    if (contactsToMerge.length === 0) {
      throw new Error("Nenhum contato válido encontrado para mesclagem");
    }

    let ticketsTransferred = 0;
    let messagesTransferred = 0;
    let customFieldsMerged = 0;
    const errors: string[] = [];

    // Processar cada contato a ser mesclado
    for (const contactToMerge of contactsToMerge) {
      try {
        // Transferir tickets
        const ticketUpdateResult = await Ticket.update(
          { contactId: primaryContactId },
          {
            where: { contactId: contactToMerge.id, companyId },
            transaction
          }
        );
        ticketsTransferred += ticketUpdateResult[0];

        // Transferir mensagens (que não estão vinculadas a tickets)
        const messageUpdateResult = await Message.update(
          { contactId: primaryContactId },
          {
            where: { 
              contactId: contactToMerge.id, 
              companyId,
              ticketId: null // Apenas mensagens sem ticket
            },
            transaction
          }
        );
        messagesTransferred += messageUpdateResult[0];

        // Mesclar campos customizados se habilitado
        if (preserveData.mergeCustomFields && contactToMerge.extraInfo) {
          for (const customField of contactToMerge.extraInfo) {
            // Verificar se o campo já existe no contato principal
            const existingField = await ContactCustomField.findOne({
              where: {
                contactId: primaryContactId,
                name: customField.name
              },
              transaction
            });

            if (!existingField) {
              // Criar novo campo no contato principal
              await ContactCustomField.create({
                contactId: primaryContactId,
                name: customField.name,
                value: customField.value
              }, { transaction });
              customFieldsMerged++;
            }
          }
        }

        // Mesclar dados do contato principal se necessário
        const updateData: any = {};
        
        // Manter data mais recente se habilitado
        if (preserveData.keepNewerCreatedAt && contactToMerge.createdAt < primaryContact.createdAt) {
          updateData.createdAt = contactToMerge.createdAt;
        }
        
        if (preserveData.keepNewerUpdatedAt && contactToMerge.updatedAt > primaryContact.updatedAt) {
          updateData.updatedAt = contactToMerge.updatedAt;
        }

        // Mesclar informações se não existirem no principal
        if (!primaryContact.email && contactToMerge.email) {
          updateData.email = contactToMerge.email;
        }

        if (!primaryContact.profilePicUrl && contactToMerge.profilePicUrl) {
          updateData.profilePicUrl = contactToMerge.profilePicUrl;
        }

        // Manter nome mais completo (maior)
        if (contactToMerge.name && contactToMerge.name.length > (primaryContact.name?.length || 0)) {
          updateData.name = contactToMerge.name;
        }

        // Atualizar contato principal se houver dados para mesclar
        if (Object.keys(updateData).length > 0) {
          await primaryContact.update(updateData, { transaction });
        }

      } catch (contactError: any) {
        errors.push(`Erro ao mesclar contato ${contactToMerge.id}: ${contactError.message}`);
        logger.error(`Erro ao mesclar contato ${contactToMerge.id}:`, contactError);
      }
    }

    // Remover contatos mesclados
    const deletedCount = await Contact.destroy({
      where: {
        id: { [Op.in]: contactIdsToMerge },
        companyId
      },
      transaction
    });

    // Recarregar contato principal com dados atualizados
    const updatedPrimaryContact = await Contact.findByPk(primaryContactId, {
      include: [
        {
          model: ContactCustomField,
          as: "extraInfo"
        }
      ],
      transaction
    });

    await transaction?.commit();

    // Emitir evento para atualizar frontend
    const io = getIO();
    io.of(`/workspace-${companyId}`).emit(`company-${companyId}-contact`, {
      action: "update",
      contact: updatedPrimaryContact
    });

    // Emitir evento para remover contatos mesclados
    contactIdsToMerge.forEach(contactId => {
      io.of(`/workspace-${companyId}`).emit(`company-${companyId}-contact`, {
        action: "delete",
        contactId
      });
    });

    logger.info(`Mesclagem concluída: ${deletedCount} contatos mesclados, ${ticketsTransferred} tickets transferidos`);

    return {
      success: true,
      mergedContact: updatedPrimaryContact,
      mergedCount: deletedCount,
      ticketsTransferred,
      messagesTransferred,
      customFieldsMerged,
      errors
    };

  } catch (error: any) {
    await transaction?.rollback();
    logger.error(`Erro na mesclagem de contatos: ${error.message}`);
    
    return {
      success: false,
      mergedContact: null,
      mergedCount: 0,
      ticketsTransferred: 0,
      messagesTransferred: 0,
      customFieldsMerged: 0,
      errors: [error.message]
    };
  }
};

export default AdvancedMergeContactsService;
