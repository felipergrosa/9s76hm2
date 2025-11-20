import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import Ticket from "../../models/Ticket";
import Queue from "../../models/Queue";
import CompaniesSettings from "../../models/CompaniesSettings";
import logger from "../../utils/logger";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";

interface Request {
  contact: Contact;
  companyId: number;
  welcomeMessage?: string;
}

const SendWelcomeMessageService = async ({
  contact,
  companyId,
  welcomeMessage,
}: Request): Promise<void> => {
  try {
    // Buscar WhatsApp padrão da empresa
    let whatsapp;
    try {
      whatsapp = await GetDefaultWhatsApp(null, companyId);
    } catch (err) {
      logger.warn({ companyId, error: err }, "Nenhum WhatsApp encontrado para enviar mensagem de boas-vindas");
      return;
    }
    
    if (!whatsapp) {
      logger.warn({ companyId }, "Nenhum WhatsApp encontrado para enviar mensagem de boas-vindas");
      return;
    }

    // Verificar se WhatsApp está conectado
    if (whatsapp.status !== "CONNECTED") {
      logger.warn({ whatsappId: whatsapp.id, status: whatsapp.status }, "WhatsApp não está conectado para enviar mensagem de boas-vindas");
      return;
    }

    // Buscar configurações da empresa
    const settings = await CompaniesSettings.findOne({
      where: { companyId }
    });

    // Buscar primeira fila disponível (ou usar null)
    const queue = await Queue.findOne({
      where: { companyId },
      order: [["id", "ASC"]]
    });

    // Criar ou encontrar ticket para o contato
    const ticket = await FindOrCreateTicketService(
      contact,
      whatsapp,
      0, // unreadMessages
      companyId,
      queue?.id || null, // queueId
      null, // userId
      null, // groupContact
      whatsapp.channel, // channel
      false, // isImported
      false, // isForward
      settings || undefined, // settings
      false, // isTransfered
      false // isCampaign
    );

    if (!ticket) {
      logger.warn({ contactId: contact.id }, "Não foi possível criar ticket para mensagem de boas-vindas");
      return;
    }

    // Mensagem padrão de boas-vindas
    const defaultMessage = `Olá ${contact.name}! 👋\n\nObrigado pelo seu interesse no TaktChat!\n\nNossa equipe entrará em contato em breve para apresentar todas as funcionalidades e como podemos ajudar sua empresa a transformar o atendimento via WhatsApp.\n\nEnquanto isso, sinta-se à vontade para nos enviar suas dúvidas! 😊`;

    const messageToSend = welcomeMessage || defaultMessage;

    // Enviar mensagem de boas-vindas
    await SendWhatsAppMessage({
      body: messageToSend,
      ticket,
    });

    logger.info({ 
      contactId: contact.id, 
      ticketId: ticket.id, 
      whatsappId: whatsapp.id,
      companyId 
    }, "Mensagem de boas-vindas enviada com sucesso");

  } catch (error: any) {
    // Não bloquear o fluxo se houver erro ao enviar mensagem
    logger.error({ 
      error: error.message, 
      contactId: contact.id, 
      companyId 
    }, "Erro ao enviar mensagem de boas-vindas");
  }
};

export default SendWelcomeMessageService;
