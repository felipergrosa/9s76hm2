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
import DownloadOfficialMediaService from "./DownloadOfficialMediaService";

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
      sticker?: {
        mime_type: string;
        sha256: string;
        id: string;
        animated?: boolean;
      };
      location?: {
        latitude: number;
        longitude: number;
        name?: string;
        address?: string;
      };
      contacts?: Array<{
        name: {
          formatted_name: string;
          first_name?: string;
          last_name?: string;
        };
        phones?: Array<{
          phone: string;
          type?: string;
          wa_id?: string;
        }>;
      }>;
      reaction?: {
        message_id: string;
        emoji: string;
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
    logger.info(`[WebhookProcessor] Processando webhook para phoneNumberId: ${phoneNumberId}`);
    // Logar parte do payload para debug (truncado para evitar logs gigantes)
    logger.info(`[WebhookProcessor] Webhook value (partial): ${JSON.stringify(value).substring(0, 800)}`);

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

  // Buscar settings da empresa
  const CompaniesSettings = (await import("../../models/CompaniesSettings")).default;
  const settings = await CompaniesSettings.findOne({
    where: { companyId }
  });

  // Encontrar ou criar ticket
  let ticket = await FindOrCreateTicketService(
    contact,
    whatsapp,
    1, // unreadMessages - incrementa 1 para cada mensagem recebida
    companyId,
    null, // queueId
    null, // userId
    undefined, // groupContact
    "whatsapp", // channel
    false, // isImported
    false, // isForward
    settings, // settings da empresa
    false, // isTransfered
    false // isCampaign
  );

  // Se o ticket está em status "campaign" e o contato respondeu, mover para fluxo normal
  if (ticket.status === "campaign") {
    logger.info(`[WebhookProcessor] Contato respondeu em ticket de campanha #${ticket.id}, movendo para fluxo normal. Fila: ${ticket.queueId}`);

    // Regra de saída de campanha:
    // - Se a fila tem bot/agente (Chatbot ou RAG) => vai para BOT
    // - Caso contrário => vai direto para ATENDENDO (open)
    let shouldGoBot = Boolean(ticket.isBot);
    try {
      if (ticket.queueId) {
        const Queue = (await import("../../models/Queue")).default;
        const queue = await Queue.findByPk(ticket.queueId, {
          include: [
            {
              association: "chatbots",
              required: false
            }
          ]
        });
        const hasChatbot = Boolean(queue?.chatbots && (queue as any).chatbots.length > 0);
        const hasRAG = Boolean(queue?.ragCollection && String(queue.ragCollection).trim());
        shouldGoBot = hasChatbot || hasRAG;
      }
    } catch (e: any) {
      logger.warn(`[WebhookProcessor] Erro ao avaliar bot/RAG da fila (queueId=${ticket.queueId}): ${e?.message || e}`);
    }

    const newStatus = shouldGoBot ? "bot" : "open";

    await ticket.update({
      status: newStatus,
      isBot: shouldGoBot,
      unreadMessages: (ticket.unreadMessages || 0) + 1
    });

    // Recarregar ticket
    const Ticket = (await import("../../models/Ticket")).default;
    const Queue = (await import("../../models/Queue")).default;
    const User = (await import("../../models/User")).default;
    ticket = await Ticket.findByPk(ticket.id, {
      include: [
        { model: Contact, as: "contact" },
        { model: Queue, as: "queue" },
        { model: User, as: "user" },
        { model: Whatsapp, as: "whatsapp" }
      ]
    });

    logger.info(`[WebhookProcessor] Ticket #${ticket.id} movido para status "${newStatus}", fila: ${ticket.queueId}`);
  } else {
    // Incrementar contador de mensagens não lidas
    await ticket.update({
      unreadMessages: (ticket.unreadMessages || 0) + 1
    });
  }
  
  logger.info(`[WebhookProcessor] Ticket ${ticket.id} criado/encontrado: status=${ticket.status}, queueId=${ticket.queueId}, isBot=${ticket.isBot}, unreadMessages=${ticket.unreadMessages}`);

  // Extrair corpo da mensagem
  let body = "";
  let mediaType: string | undefined;
  let mediaUrl: string | undefined;

  switch (message.type) {
    case "text":
      body = message.text?.body || "";
      mediaType = "conversation";
      break;

    case "image":
      body = message.image?.caption || "";
      mediaType = "image";
      
      // Baixar mídia da Meta API
      if (message.image?.id) {
        try {
          mediaUrl = await DownloadOfficialMediaService({
            mediaId: message.image.id,
            whatsapp,
            companyId,
            contactId: contact.id,
            mediaType: "image"
          });
          logger.info(`[WebhookProcessor] Imagem baixada: ${mediaUrl}`);
        } catch (error: any) {
          logger.error(`[WebhookProcessor] Erro ao baixar imagem: ${error.message}`);
          mediaUrl = undefined; // Falha silenciosa, mensagem será texto
        }
      }
      break;

    case "video":
      body = message.video?.caption || "";
      mediaType = "video";
      
      if (message.video?.id) {
        try {
          mediaUrl = await DownloadOfficialMediaService({
            mediaId: message.video.id,
            whatsapp,
            companyId,
            contactId: contact.id,
            mediaType: "video"
          });
          logger.info(`[WebhookProcessor] Vídeo baixado: ${mediaUrl}`);
        } catch (error: any) {
          logger.error(`[WebhookProcessor] Erro ao baixar vídeo: ${error.message}`);
          mediaUrl = undefined;
        }
      }
      break;

    case "audio":
      body = "";
      mediaType = "audio";
      
      if (message.audio?.id) {
        try {
          mediaUrl = await DownloadOfficialMediaService({
            mediaId: message.audio.id,
            whatsapp,
            companyId,
            contactId: contact.id,
            mediaType: "audio"
          });
          logger.info(`[WebhookProcessor] Áudio baixado: ${mediaUrl}`);
        } catch (error: any) {
          logger.error(`[WebhookProcessor] Erro ao baixar áudio: ${error.message}`);
          mediaUrl = undefined;
        }
      }
      break;

    case "document":
      body = message.document?.caption || message.document?.filename || "";
      mediaType = "document";
      
      if (message.document?.id) {
        try {
          mediaUrl = await DownloadOfficialMediaService({
            mediaId: message.document.id,
            whatsapp,
            companyId,
            contactId: contact.id,
            mediaType: "document"
          });
          logger.info(`[WebhookProcessor] Documento baixado: ${mediaUrl}`);
        } catch (error: any) {
          logger.error(`[WebhookProcessor] Erro ao baixar documento: ${error.message}`);
          mediaUrl = undefined;
        }
      }
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

    case "sticker":
      body = "sticker";
      mediaType = "sticker";
      
      if (message.sticker?.id) {
        try {
          mediaUrl = await DownloadOfficialMediaService({
            mediaId: message.sticker.id,
            whatsapp,
            companyId,
            contactId: contact.id,
            mediaType: "sticker"
          });
          logger.info(`[WebhookProcessor] Sticker baixado: ${mediaUrl}`);
        } catch (error: any) {
          logger.error(`[WebhookProcessor] Erro ao baixar sticker: ${error.message}`);
          mediaUrl = undefined;
        }
      }
      break;

    case "location":
      // Formato compatível com LocationPreview do frontend
      const lat = message.location?.latitude || 0;
      const lng = message.location?.longitude || 0;
      const locationName = message.location?.name || "";
      const locationAddress = message.location?.address || "";
      const description = locationName ? `${locationName}\\n${locationAddress}` : `${lat}, ${lng}`;
      
      // Formato: base64_image | maps_link | description
      const mapsLink = `https://maps.google.com/maps?q=${lat}%2C${lng}&z=17&hl=pt-BR`;
      body = `data:image/png;base64, | ${mapsLink} | ${description}`;
      mediaType = "locationMessage";
      logger.info(`[WebhookProcessor] Localização recebida: ${lat}, ${lng}`);
      break;

    case "contacts":
      // Formato vCard compatível com VcardPreview do frontend
      if (message.contacts && message.contacts.length > 0) {
        const vCards: string[] = [];
        for (const c of message.contacts) {
          const name = c.name?.formatted_name || "Contato";
          const phones = c.phones?.map(p => p.phone).join(", ") || "";
          // Formato vCard simplificado
          vCards.push(`BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL:${phones}\nEND:VCARD`);
        }
        body = vCards.join("\n");
        mediaType = "contactMessage";
        logger.info(`[WebhookProcessor] Contato(s) recebido(s): ${message.contacts.length}`);
      }
      break;

    case "reaction":
      body = message.reaction?.emoji || "👍";
      mediaType = "reactionMessage";
      logger.info(`[WebhookProcessor] Reação recebida: ${body}`);
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

  // Emitir evento via Socket.IO apenas para a sala do ticket específico
  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .to(ticket.uuid)  // CRÍTICO: Emitir apenas para a sala do ticket, não broadcast
    .emit(`company-${companyId}-appMessage`, {
      action: "create",
      message: createdMessage,
      ticket,
      contact
    });

  // Processar bot/IA se ticket está marcado como bot
  if (ticket.status === "bot" && ticket.queueId && !message.from.includes(whatsapp.wabaPhoneNumberId || "")) {
    logger.info(`[WebhookProcessor] Ticket ${ticket.id} é bot (status: ${ticket.status}, queue: ${ticket.queueId}), processando IA/Prompt...`);
    
    try {
      // Verificar debounce para evitar mensagens duplicadas
      const { canProcessBotMessage } = await import("../../helpers/BotDebounce");
      
      if (!canProcessBotMessage(ticket.id, messageId)) {
        logger.info(`[WebhookProcessor] Mensagem ${messageId} ignorada por debounce (ticket ${ticket.id})`);
        return;
      }
      
      // Importar dinamicamente para evitar circular dependencies
      const { processOfficialBot } = await import("./ProcessOfficialBot");
      await processOfficialBot({
        message: createdMessage,
        ticket,
        contact,
        whatsapp,
        companyId
      });
    } catch (error: any) {
      logger.error(`[WebhookProcessor] Erro ao processar bot: ${error.message}`);
      Sentry.captureException(error);
    }
  }

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

    // Buscar ticket para emitir apenas para a sala correta
    const ticket = await Ticket.findByPk(message.ticketId);
    if (ticket) {
      // Emitir evento via Socket.IO apenas para a sala do ticket específico
      const io = getIO();
      io.of(`/workspace-${companyId}`)
        .to(ticket.uuid)  // CRÍTICO: Emitir apenas para a sala do ticket, não broadcast
        .emit(`company-${companyId}-appMessage`, {
          action: "update",
          message,
          ticket
        });
    }
  } else {
    logger.debug(`[WebhookProcessor] Mensagem ${messageId} não encontrada no banco`);
  }
}

export default ProcessWhatsAppWebhook;
