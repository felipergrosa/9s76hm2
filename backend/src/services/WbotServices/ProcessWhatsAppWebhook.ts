import logger from "../../utils/logger";
import * as Sentry from "@sentry/node";
import { Mutex } from "async-mutex";
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
import { safeNormalizePhoneNumber } from "../../utils/phone";
import { UpdateSessionWindow } from "../TicketServices/UpdateSessionWindowService";
import { sessionWindowRenewalQueue } from "../../queues";
import { Op } from "sequelize";

// Lock mechanism para evitar race conditions na criação de contatos/tickets
const contactLocks = new Map<string, Mutex>();

const getContactLock = (key: string): Mutex => {
  if (!contactLocks.has(key)) {
    contactLocks.set(key, new Mutex());
  }
  return contactLocks.get(key)!;
};

const loadRealtimeTicketPayload = async (ticketId: number) => {
  return Ticket.findByPk(ticketId, {
    include: [
      { model: Contact, as: "contact" },
      { model: Whatsapp, as: "whatsapp" }
    ]
  });
};

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
 * Helper: Processa mensagem quando já temos o contato (usado quando message.from é um ID Meta)
 */
async function processMessageWithExistingContact(
  contact: Contact,
  message: any,
  whatsapp: Whatsapp,
  companyId: number,
  value: any,
  messageId: string,
  timestamp: number
): Promise<void> {
  // Buscar settings da empresa
  const CompaniesSettings = (await import("../../models/CompaniesSettings")).default;
  const settings = await CompaniesSettings.findOne({
    where: { companyId }
  });

  // Encontrar ou criar ticket
  let ticket = await FindOrCreateTicketService(
    contact,
    whatsapp,
    1,
    companyId,
    null,
    null,
    undefined,
    "whatsapp",
    false,
    false,
    settings,
    false,
    false
  );

  // Incrementar contador de mensagens não lidas
  await ticket.update({
    unreadMessages: (ticket.unreadMessages || 0) + 1
  });

  logger.info(`[WebhookProcessor] Ticket ${ticket.id} usado para mensagem de ID Meta (contato=${contact.id})`);

  // Processar corpo da mensagem de forma simplificada
  let body = "";
  let mediaType: string | undefined;

  switch (message.type) {
    case "text":
      body = message.text?.body || "";
      mediaType = "conversation";
      break;
    default:
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
      read: false,
      ack: 0
    },
    companyId
  });

  logger.info(`[WebhookProcessor] Mensagem criada via fallback: ${createdMessage.id}`);

  // Emitir evento via Socket.IO
  const realtimeTicket = await loadRealtimeTicketPayload(ticket.id);
  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .to(ticket.uuid)
    .emit(`company-${companyId}-appMessage`, {
      action: "create",
      message: createdMessage,
      ticket: realtimeTicket || ticket,
      contact,
    });

  io.of(`/workspace-${companyId}`)
    .emit(`company-${companyId}-appMessage`, {
      action: "create",
      message: createdMessage,
      contact
    });
}

/**
 * Processa mensagem recebida do webhook (com lock por contato para evitar duplicados)
 */
async function processIncomingMessage(
  message: any,
  whatsapp: Whatsapp,
  companyId: number,
  value: any
): Promise<void> {
  const from = message.from;
  const messageId = message.id;
  const timestamp = parseInt(message.timestamp) * 1000;

  // CRÍTICO: Ignorar mensagens que já existem no banco (enviadas por nós mesmos)
  const existingMessage = await Message.findOne({
    where: {
      wid: messageId,
      companyId
    },
    attributes: ["id", "fromMe"]
  });

  if (existingMessage) {
    logger.info(`[WebhookProcessor] Mensagem ${messageId} já existe no banco (fromMe=${existingMessage.fromMe}), ignorando webhook duplicado`);
    return;
  }

  logger.info(`[WebhookProcessor] Mensagem recebida: ${messageId} de ${from}`);

  // Extrair nome do contato e número real
  let contactName = from;
  let actualPhoneNumber = from;

  if (value.contacts && value.contacts.length > 0) {
    let contactInfo = value.contacts.find((c: any) => c.wa_id === from);
    if (!contactInfo && value.contacts[0]) {
      contactInfo = value.contacts[0];
    }

    if (contactInfo) {
      if (contactInfo.profile && contactInfo.profile.name) {
        contactName = contactInfo.profile.name;
      }
      if (contactInfo.wa_id) {
        const { canonical } = safeNormalizePhoneNumber(contactInfo.wa_id);
        if (canonical) {
          actualPhoneNumber = canonical;
          logger.info(`[WebhookProcessor] Usando wa_id real normalizado: ${actualPhoneNumber} (message.from era: ${from})`);
        }
      }
    }
  }

  const { canonical: finalCanonical } = safeNormalizePhoneNumber(actualPhoneNumber);
  const isMetaId = !finalCanonical && actualPhoneNumber.replace(/\D/g, "").length > 13;

  if (isMetaId) {
    logger.warn(`[WebhookProcessor] Número ${actualPhoneNumber} parece ser ID Meta. Tentando fallback...`);
    const existingByName = await Contact.findOne({
      where: {
        name: contactName,
        companyId,
        isGroup: false
      }
    });

    if (existingByName) {
      logger.info(`[WebhookProcessor] Contato encontrado pelo nome "${contactName}" (id=${existingByName.id}), evitando duplicata`);
      await processMessageWithExistingContact(existingByName, message, whatsapp, companyId, value, messageId, timestamp);
      return;
    } else {
      logger.error(`[WebhookProcessor] REJEITADO: Não foi possível resolver número real para ID Meta ${from}. Mensagem ignorada.`);
      return;
    }
  }

  // Lock por contato para evitar race conditions
  const lockKey = `contact-${actualPhoneNumber}-${companyId}`;
  const lock = getContactLock(lockKey);

  await lock.runExclusive(async () => {
    logger.info(`[WebhookProcessor] Lock adquirido para ${lockKey}`);

    // Criar ou atualizar contato
    let contact: Contact | null = null;
    try {
      contact = await CreateOrUpdateContactService({
        name: contactName,
        number: actualPhoneNumber,
        isGroup: false,
        companyId,
        channel: "whatsapp",
        whatsappId: whatsapp.id,
        checkProfilePic: true
      });
      logger.info(`[WebhookProcessor] Contato resolvido: id=${contact.id}, number=${contact.number}`);
    } catch (e: any) {
      logger.error(`[WebhookProcessor] Erro ao criar/atualizar contato: ${e.message}`);
      return;
    }

    if (!contact) {
      logger.error(`[WebhookProcessor] Falha crítica: Contato não retornado pelo serviço.`);
      return;
    }

    // Buscar settings da empresa
    const CompaniesSettings = (await import("../../models/CompaniesSettings")).default;
    const settings = await CompaniesSettings.findOne({
      where: { companyId }
    });

    // Encontrar ou criar ticket
    let ticket = await FindOrCreateTicketService(
      contact,
      whatsapp,
      1,
      companyId,
      null,
      null,
      undefined,
      "whatsapp",
      false,
      false,
      settings,
      false,
      false
    );

    logger.info(`[WebhookProcessor] Ticket resolvido: id=${ticket.id}, status=${ticket.status}`);

    // Se ticket estava em campanha, mudar para pending/bot
    if (ticket.status === "campaign") {
      logger.info(`[WebhookProcessor] Contato respondeu em ticket de campanha #${ticket.id}, movendo para fluxo normal. Fila: ${ticket.queueId}`);
      let newStatus = "pending";
      if (ticket.isBot) {
        newStatus = "bot";
      }

      await ticket.update({ status: newStatus });

      const ShowTicketService = (await import("../TicketServices/ShowTicketService")).default;
      ticket = await ShowTicketService(ticket.id, companyId);

      const { ticketEventBus } = await import("../TicketServices/TicketEventBus");
      ticketEventBus.publishStatusChanged(companyId, ticket.id, ticket.uuid, ticket, "campaign", newStatus);
    }

    // Processar corpo da mensagem
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
        if (message.image?.id) {
          try {
            mediaUrl = await DownloadOfficialMediaService({
              mediaId: message.image.id,
              whatsapp,
              companyId,
              contactId: contact.id,
              mediaType: "image"
            });
            mediaType = "image";
          } catch (err: any) {
            logger.error(`[WebhookProcessor] Erro ao baixar imagem: ${err.message}`);
            body += " (Erro ao baixar mídia)";
          }
        }
        break;

      case "video":
        body = message.video?.caption || "";
        if (message.video?.id) {
          try {
            mediaUrl = await DownloadOfficialMediaService({
              mediaId: message.video.id,
              whatsapp,
              companyId,
              contactId: contact.id,
              mediaType: "video"
            });
            mediaType = "video";
          } catch (err: any) {
            logger.error(`[WebhookProcessor] Erro ao baixar vídeo: ${err.message}`);
            body += " (Erro ao baixar mídia)";
          }
        }
        break;

      case "audio":
      case "voice":
        if (message.audio?.id || message.voice?.id) {
          try {
            const audioId = message.audio?.id || message.voice?.id;
            mediaUrl = await DownloadOfficialMediaService({
              mediaId: audioId,
              whatsapp,
              companyId,
              contactId: contact.id,
              mediaType: "audio"
            });
            mediaType = "audio";
          } catch (err: any) {
            logger.error(`[WebhookProcessor] Erro ao baixar áudio: ${err.message}`);
            body = "(Erro ao baixar mídia)";
          }
        }
        break;

      case "document":
        body = message.document?.caption || message.document?.filename || "";
        if (message.document?.id) {
          try {
            mediaUrl = await DownloadOfficialMediaService({
              mediaId: message.document.id,
              whatsapp,
              companyId,
              contactId: contact.id,
              mediaType: "document"
            });
            mediaType = "document";
          } catch (err: any) {
            logger.error(`[WebhookProcessor] Erro ao baixar documento: ${err.message}`);
            body += " (Erro ao baixar mídia)";
          }
        }
        break;

      case "sticker":
        if (message.sticker?.id) {
          try {
            mediaUrl = await DownloadOfficialMediaService({
              mediaId: message.sticker.id,
              whatsapp,
              companyId,
              contactId: contact.id,
              mediaType: "sticker"
            });
            mediaType = "sticker";
          } catch (err: any) {
            logger.error(`[WebhookProcessor] Erro ao baixar sticker: ${err.message}`);
            body = "(Sticker)";
          }
        }
        break;

      case "location":
        const lat = message.location?.latitude;
        const lng = message.location?.longitude;
        const locName = message.location?.name || "";
        const description = message.location?.address || "";
        const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
        body = `data:image/png;base64, | ${mapsLink} | ${description}`;
        mediaType = "locationMessage";
        logger.info(`[WebhookProcessor] Localização recebida: ${lat}, ${lng}`);
        break;

      case "contacts":
        if (message.contacts && message.contacts.length > 0) {
          const vCards: string[] = [];
          for (const c of message.contacts) {
            const name = c.name?.formatted_name || "Contato";
            const phones = c.phones?.map((p: any) => p.phone).join(", ") || "";
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

    // Atualizar ticket com contador de mensagens não lidas
    await ticket.update({
      lastMessage: body,
      updatedAt: new Date(),
      unreadMessages: (ticket.unreadMessages || 0) + 1
    });

    // Atualizar janela de sessão de 24h (API Oficial)
    await UpdateSessionWindow(ticket.id, whatsapp.id);

    const realtimeTicket = await loadRealtimeTicketPayload(ticket.id);
    if (realtimeTicket) {
      ticket = realtimeTicket as any;
    }

    // AGENDAR renovação automática via Bull Queue
    try {
      const renewalMinutes = whatsapp.sessionWindowRenewalMinutes || 60;
      const delayMs = (24 * 60 - renewalMinutes) * 60 * 1000;
      
      const jobId = `window-renewal-${ticket.id}`;
      const existingJob = await sessionWindowRenewalQueue.getJob(jobId);
      
      if (existingJob) {
        await existingJob.remove();
        logger.info(`[WebhookProcessor] Job anterior removido: ${jobId}`);
      }
      
      await sessionWindowRenewalQueue.add(
        {
          ticketId: ticket.id,
          companyId: companyId
        },
        {
          jobId: jobId,
          delay: delayMs,
          attempts: 3,
          backoff: {
            type: 'fixed',
            delay: 60000
          }
        }
      );
    
      logger.info(
        `[WebhookProcessor] Agendado renovação de janela para ticket ${ticket.id} ` +
        `(envio em ${Math.floor(delayMs / 3600000)}h se não houver resposta)`
      );
    } catch (scheduleError: any) {
      logger.error(
        `[WebhookProcessor] Erro ao agendar renovação de janela para ticket ${ticket.id}: ${scheduleError.message}`
      );
    }

    // Emitir evento via Socket.IO
    const io = getIO();
    io.of(`/workspace-${companyId}`)
      .to(ticket.uuid)
      .emit(`company-${companyId}-appMessage`, {
        action: "create",
        message: createdMessage,
        ticket,
        contact
      });

    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-appMessage`, {
        action: "create",
        message: createdMessage,
        ticket,
        contact
      });

    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket
      });

    // Processar bot/IA se ticket está marcado como bot
    if (ticket.status === "bot" && ticket.queueId && !message.from.includes(whatsapp.wabaPhoneNumberId || "")) {
      logger.info(`[WebhookProcessor] Ticket ${ticket.id} é bot (status: ${ticket.status}, queue: ${ticket.queueId}), processando IA/Prompt...`);

      try {
        const { canProcessBotMessage } = await import("../../helpers/BotDebounce");

        if (!canProcessBotMessage(ticket.id, messageId)) {
          logger.info(`[WebhookProcessor] Mensagem ${messageId} ignorada por debounce (ticket ${ticket.id})`);
          return;
        }

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

    // Marcar mensagem como lida automaticamente
    const adapter = WhatsAppFactory.getAdapter(whatsapp.id);
    if (adapter && adapter.markAsRead) {
      try {
        await adapter.markAsRead(messageId);
      } catch (error: any) {
        logger.warn(`[WebhookProcessor] Falha ao marcar como lida: ${error.message}`);
      }
    }

    logger.info(`[WebhookProcessor] Lock liberado para ${lockKey}`);
  });
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

  // CQRS: Usar MessageCommandService para atualizar ACK
  // Isso já faz: busca mensagem + valida ack + update DB + emite evento via EventBus
  const { updateMessageAckByWid } = await import("../MessageServices/MessageCommandService");

  const updatedMessage = await updateMessageAckByWid(messageId, ack);

  if (updatedMessage) {
    logger.debug(`[WebhookProcessor] Mensagem ${messageId} atualizada para ack=${ack} via CQRS`);
  } else {
    logger.debug(`[WebhookProcessor] Mensagem ${messageId} não encontrada no banco`);
  }
}

export default ProcessWhatsAppWebhook;
