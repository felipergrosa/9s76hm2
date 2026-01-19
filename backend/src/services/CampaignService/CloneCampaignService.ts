import Campaign from "../../models/Campaign";
import AppError from "../../errors/AppError";
import ContactList from "../../models/ContactList";
import Whatsapp from "../../models/Whatsapp";
import User from "../../models/User";
import Queue from "../../models/Queue";

/**
 * Serviço para clonar uma campanha existente
 * Cria uma cópia com status INATIVA e nome prefixado
 */
const CloneCampaignService = async (campaignId: string | number): Promise<Campaign> => {
    // Buscar campanha original
    const original = await Campaign.findByPk(campaignId);

    if (!original) {
        throw new AppError("ERR_CAMPAIGN_NOT_FOUND", 404);
    }

    // Campos a serem copiados
    const cloneData: any = {
        name: `Cópia de - ${original.name}`,
        companyId: original.companyId,
        status: "INATIVA", // Sempre inicia como inativa
        confirmation: original.confirmation,
        scheduledAt: null, // Não copia agendamento
        contactListId: original.contactListId,
        whatsappId: original.whatsappId,
        // Mensagens
        message1: original.message1,
        message2: original.message2,
        message3: original.message3,
        message4: original.message4,
        message5: original.message5,
        // Mensagens de confirmação
        confirmationMessage1: original.confirmationMessage1,
        confirmationMessage2: original.confirmationMessage2,
        confirmationMessage3: original.confirmationMessage3,
        confirmationMessage4: original.confirmationMessage4,
        confirmationMessage5: original.confirmationMessage5,
        // Mídias
        mediaUrl1: original.mediaUrl1,
        mediaName1: original.mediaName1,
        mediaUrl2: original.mediaUrl2,
        mediaName2: original.mediaName2,
        mediaUrl3: original.mediaUrl3,
        mediaName3: original.mediaName3,
        mediaUrl4: original.mediaUrl4,
        mediaName4: original.mediaName4,
        mediaUrl5: original.mediaUrl5,
        mediaName5: original.mediaName5,
        // Configurações
        userId: original.userId,
        userIds: original.userIds,
        queueId: original.queueId,
        statusTicket: original.statusTicket,
        openTicket: original.openTicket,
        dispatchStrategy: original.dispatchStrategy,
        allowedWhatsappIds: original.allowedWhatsappIds,
        // Templates Meta
        metaTemplateName: original.metaTemplateName,
        metaTemplateLanguage: original.metaTemplateLanguage,
        metaTemplateVariables: original.metaTemplateVariables,
    };

    // Criar nova campanha
    const cloned = await Campaign.create(cloneData);

    // Recarregar com includes
    await cloned.reload({
        include: [
            { model: ContactList },
            { model: Whatsapp, attributes: ["id", "name"] },
            { model: User, attributes: ["id", "name"] },
            { model: Queue, attributes: ["id", "name"] },
        ]
    });

    return cloned;
};

export default CloneCampaignService;
