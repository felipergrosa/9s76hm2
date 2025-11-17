import logger from "../../utils/logger";
import * as Sentry from "@sentry/node";
import { WhatsAppFactory, IWhatsAppMessage } from "../../libs/whatsapp";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { getIO } from "../../libs/socket";

/**
 * Interface para mudança (change) do webhook Meta
 */
interface WebhookChange {
  value: {
    messaging_product: string;
    metadata: {
      display_phone_number: string;
      phone_number_id: string;
    };
    contacts?: Array<{
      profile: {
        name: string;
      };
      wa_id: string;
    }>;
    messages?: Array<{
      from: string;
      id: string;
      timestamp: string;
      type: string;
      text?: {
        body: string;
      };
      image?: {
        caption?: string;
        mime_type: string;
        sha256: string;
        id: string;
      };
      video?: {
        caption?: string;
        mime_type: string;
        id: string;
      };
      audio?: {
        mime_type: string;
        id: string;
      };
      document?: {
        caption?: string;
        filename?: string;
        mime_type: string;
        id: string;
      };
      button?: {
        text: string;
        payload: string;
      };
      interactive?: {
        type: string;
        button_reply?: {
          id: string;
          title: string;
        };
        list_reply?: {
          id: string;
          title: string;
          description?: string;
        };
      };
    }>;
    statuses?: Array<{
      id: string;
      status: "sent" | "delivered" | "read" | "failed";
      timestamp: string;
      recipient_id: string;
      errors?: any[];
    }>;
  };
  field: string;
}

/**
 * Processa eventos do webhook WhatsApp Business API
 */
const ProcessWhatsAppWebhook = async (change: WebhookChange): Promise<void> => {
  try {
    const { value, field } = change;

    if (field !== "messages") {
      logger.debug(`[WebhookProcessor] Ignorando field: ${field}`);
      return;
    }

    const phoneNumberId = value.metadata.phone_number_id;
    logger.debug(`[WebhookProcessor] Processando webhook para phoneNumberId: ${phoneNumberId}`);

    // Buscar conexão WhatsApp pelo phoneNumberId
    const whatsapp = await Whatsapp.findOne({
      where: {
        wabaPhoneNumberId: phoneNumberId,
        channelType: "official"
      }
    });

    if (!whatsapp) {
      logger.warn(`[WebhookProcessor] WhatsApp não encontrado para phoneNumberId: ${phoneNumberId}`);
      return;
    }

    const companyId = whatsapp.companyId;

    // Processar mensagens recebidas
    if (value.messages && value.messages.length > 0) {
      for (const message of value.messages) {
        try {
          await processIncomingMessage(message, whatsapp, companyId, value);
        } catch (error: any) {
          Sentry.captureException(error);
          logger.error(`[WebhookProcessor] Erro ao processar mensagem ${message.id}: ${error.message}`);
        }
      }
    }

    // Processar status de mensagens enviadas
    if (value.statuses && value.statuses.length > 0) {
      for (const status of value.statuses) {
        try {
          await processMessageStatus(status, whatsapp, companyId);
        } catch (error: any) {
          Sentry.captureException(error);
          logger.error(`[WebhookProcessor] Erro ao processar status ${status.id}: ${error.message}`);
        }
      }
    }

  } catch (error: any) {
    Sentry.captureException(error);
    logger.error(`[WebhookProcessor] Erro geral: ${error.message}`);
    throw error;
  }
};

/**
 * Processa mensagem recebida
 */
async function processIncomingMessage(
  message: any,
  whatsapp: Whatsapp,
  companyId: number,
  value: any
): Promise<void> {
  const from = message.from;
  const messageId = message.id;
  const timestamp = parseInt(message.timestamp) * 1000; // Converter para ms

  logger.info(`[WebhookProcessor] Mensagem recebida: ${messageId} de ${from}`);

  // Extrair nome do contato se disponível
  let contactName = from;
  if (value.contacts && value.contacts.length > 0) {
    const contactInfo = value.contacts.find((c: any) => c.wa_id === from);
    if (contactInfo && contactInfo.profile && contactInfo.profile.name) {
      contactName = contactInfo.profile.name;
    }
  }

  // Criar ou atualizar contato
  const contact = await CreateOrUpdateContactService({
    name: contactName,
    number: from,
    isGroup: false,
    companyId,
    whatsappId: whatsapp.id
  });

  // Encontrar ou criar ticket
  const ticket = await FindOrCreateTicketService(
    contact,
    whatsapp,
    0, // unreadMessages
    companyId,
    null, // queueId
    null, // userId
    undefined, // groupContact
    "whatsapp", // channel
    false, // isImported
    false, // isForward
    {}, // settings
    false, // isTransfered
    false // isCampaign
  );

  // Extrair corpo da mensagem
  let body = "";
  let mediaType: string | undefined;
  let mediaUrl: string | undefined;

  switch (message.type) {
    case "text":
      body = message.text?.body || "";
      break;

    case "image":
      body = message.image?.caption || "";
      mediaType = "image";
      mediaUrl = message.image?.id; // ID temporário da Meta
      break;

    case "video":
      body = message.video?.caption || "";
      mediaType = "video";
      mediaUrl = message.video?.id;
      break;

    case "audio":
      body = "";
      mediaType = "audio";
      mediaUrl = message.audio?.id;
      break;

    case "document":
      body = message.document?.caption || message.document?.filename || "";
      mediaType = "document";
      mediaUrl = message.document?.id;
      break;

    case "button":
      body = message.button?.text || "";
      break;

    case "interactive":
      if (message.interactive?.button_reply) {
        body = message.interactive.button_reply.title;
      } else if (message.interactive?.list_reply) {
        body = message.interactive.list_reply.title;
      }
      break;

    default:
      logger.warn(`[WebhookProcessor] Tipo de mensagem não suportado: ${message.type}`);
      body = `[${message.type}]`;
  }

  // Criar mensagem no banco
  const createdMessage = await CreateMessageService({
    messageData: {
      wid: messageId,
      ticketId: ticket.id,
      contactId: contact.id,
      body,
      fromMe: false,
      mediaType,
      mediaUrl,
      read: false,
      ack: 0
    },
    companyId
  });

  logger.info(`[WebhookProcessor] Mensagem criada: ${createdMessage.id}`);

  // Emitir evento via Socket.IO
  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company-${companyId}-appMessage`, {
      action: "create",
      message: createdMessage,
      ticket,
      contact
    });

  // Marcar mensagem como lida automaticamente (se configurado)
  const adapter = WhatsAppFactory.getAdapter(whatsapp.id);
  if (adapter && adapter.markAsRead) {
    try {
      await adapter.markAsRead(messageId);
    } catch (error: any) {
      logger.warn(`[WebhookProcessor] Falha ao marcar como lida: ${error.message}`);
    }
  }
}

/**
 * Processa status de mensagem enviada (ack)
 */
async function processMessageStatus(
  status: any,
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> {
  const messageId = status.id;
  const ackStatus = status.status;

  logger.debug(`[WebhookProcessor] Status recebido: ${messageId} = ${ackStatus}`);

  // Mapear status Meta para ack numérico
  let ack = 0;
  switch (ackStatus) {
    case "sent":
      ack = 1;
      break;
    case "delivered":
      ack = 2;
      break;
    case "read":
      ack = 3;
      break;
    case "failed":
      ack = -1;
      break;
  }

  // Atualizar mensagem no banco
  const message = await Message.findOne({
    where: { wid: messageId }
  });

  if (message) {
    await message.update({ ack });

    logger.debug(`[WebhookProcessor] Mensagem ${messageId} atualizada para ack=${ack}`);

    // Emitir evento via Socket.IO
    const io = getIO();
    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-appMessage`, {
        action: "update",
        message
      });
  } else {
    logger.debug(`[WebhookProcessor] Mensagem ${messageId} não encontrada no banco`);
  }
}

export default ProcessWhatsAppWebhook;
