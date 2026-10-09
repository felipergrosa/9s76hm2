import cacheLayer from "../../libs/cache";
import logger from "../../utils/logger";
import * as Sentry from "@sentry/node";
import { Mutex } from "async-mutex";
import { WhatsAppFactory, IWhatsAppMessage } from "../../libs/whatsapp";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Tag from "../../models/Tag";
import User from "../../models/User";
import Queue from "../../models/Queue";
import Company from "../../models/Company";
import Plan from "../../models/Plan";
import QueueIntegrations from "../../models/QueueIntegrations";
import TicketTag from "../../models/TicketTag";
import ContactCustomField from "../../models/ContactCustomField";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { getIO } from "../../libs/socket";
import { emitToCompanyRoom } from "../../libs/socketEmit";
import DownloadOfficialMediaService from "./DownloadOfficialMediaService";
import { safeNormalizePhoneNumber } from "../../utils/phone";
import { UpdateSessionWindow } from "../TicketServices/UpdateSessionWindowService";
import { sessionWindowRenewalQueue } from "../../queues";
import CampaignShipping from "../../models/CampaignShipping";
import removeCampaignMarkerTags from "../../helpers/removeCampaignMarkerTags";
import { Op } from "sequelize";

// Lock mechanism para evitar race conditions na criação de contatos/tickets
const contactLocks = new Map<string, { mutex: Mutex; users: number }>();

const getContactLock = (key: string): Mutex => {
  if (!contactLocks.has(key)) {
    contactLocks.set(key, { mutex: new Mutex(), users: 0 });
  }
  const entry = contactLocks.get(key)!;
  entry.users += 1;
  return entry.mutex;
};

const releaseContactLock = (key: string, mutex: Mutex): void => {
  const entry = contactLocks.get(key);
  if (!entry || entry.mutex !== mutex) return;
  entry.users -= 1;
  if (entry.users === 0) contactLocks.delete(key);
};

// Contador cumulativo de não-lidas por contato — mesmo contrato do
// wbotMessageListener (cache contacts:{id}:unreads, zerado pelo SetTicketMessagesAsRead)
const nextUnreadCount = async (contactId: number): Promise<number> => {
  const current = await cacheLayer.get(`contacts:${contactId}:unreads`);
  const next = Number(current || 0) + 1;
  await cacheLayer.set(`contacts:${contactId}:unreads`, `${next}`);
  return next;
};

// Payload realtime do ticket: mesmas associações do ShowTicketService
// (contact.tags com cor, user.color, queue etc.) para que o evento
// `company-N-ticket` action=update não apague badges/cores no frontend,
// que substitui o ticket inteiro ao receber o evento.
const loadRealtimeTicketPayload = async (ticketId: number) => {
  return Ticket.findByPk(ticketId, {
    include: [
      {
        model: Contact,
        as: "contact",
        include: [
          { model: ContactCustomField, as: "extraInfo" },
          { model: Tag, as: "tags", attributes: ["id", "name", "color"] }
        ]
      },
      {
        model: Queue,
        as: "queue",
        attributes: ["id", "name", "color", "slaMinutes"],
        include: ["chatbots"]
      },
      { model: User, as: "user", attributes: ["id", "name", "profileImage", "color"] },
      { model: Tag, as: "tags", attributes: ["id", "name", "color", "kanban"] },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name", "color", "groupAsTicket", "status", "channelType"]
      },
      {
        model: Company,
        as: "company",
        attributes: ["id", "name"],
        include: [{ model: Plan, as: "plan", attributes: ["id", "name", "useKanban"] }]
      },
      { model: QueueIntegrations, as: "queueIntegration", attributes: ["id", "name"] },
      { model: TicketTag, as: "ticketTags", attributes: ["tagId"] }
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
      context?: {
        from?: string;
        id?: string;
      };
      // Referral de anúncio Click-to-WhatsApp (CTWA): presente quando a
      // mensagem foi iniciada a partir de um anúncio da Meta
      // (source_type="ad", ctwa_clid, source_id=id do anúncio, headline)
      referral?: {
        source_type?: string;
        source_id?: string;
        source_url?: string;
        headline?: string;
        body?: string;
        media_type?: string;
        ctwa_clid?: string;
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

const serializeOfficialWebhookMessage = (message: any): string =>
  JSON.stringify({
    source: "official-webhook",
    message
  });

// Extrai a atribuição de anúncio Click-to-WhatsApp (CTWA) do referral da
// mensagem. Anúncios da Meta chegam com referral.source_type === "ad".
const extractCtwaReferral = (
  message: any
): { ctwaClid: string | null; adId: string | null; adHeadline: string | null } | null => {
  const referral = message?.referral;
  if (!referral || referral.source_type !== "ad") return null;

  const ctwaClid = referral.ctwa_clid ? String(referral.ctwa_clid) : null;
  const adId = referral.source_id ? String(referral.source_id) : null;
  const adHeadline = referral.headline ? String(referral.headline) : null;

  // Sem identificador algum não há o que atribuir
  if (!ctwaClid && !adId) return null;

  return { ctwaClid, adId, adHeadline };
};

// Grava a atribuição CTWA no ticket somente se ele ainda não tiver uma
// (first-touch por ciclo de atendimento: não sobrescreve um anúncio
// já registrado). Falha aqui não pode derrubar o processamento da mensagem.
const persistCtwaReferral = async (ticket: Ticket, message: any): Promise<void> => {
  const referral = extractCtwaReferral(message);
  if (!referral || ticket?.ctwaClid) return;

  try {
    await ticket.update({
      ctwaClid: referral.ctwaClid,
      adId: referral.adId,
      adHeadline: referral.adHeadline
    });
    logger.info(
      `[WebhookProcessor] Atribuição CTWA gravada no ticket ${ticket.id}: adId=${referral.adId}`
    );
  } catch (err: any) {
    logger.warn(
      `[WebhookProcessor] Erro ao gravar CTWA no ticket ${ticket?.id}: ${err.message}`
    );
  }
};

const findReferencedOfficialMessage = async (
  message: any,
  companyId: number
): Promise<Message | null> => {
  const referencedWid = message?.context?.id || message?.reaction?.message_id;

  if (!referencedWid) {
    return null;
  }

  const referencedMessage = await Message.findOne({
    where: {
      wid: referencedWid,
      companyId
    },
    attributes: ["id", "wid", "body"]
  });

  if (!referencedMessage) {
    logger.warn(`[WebhookProcessor] Mensagem referenciada não encontrada: wid=${referencedWid}`);
    return null;
  }

  logger.info(`[WebhookProcessor] Mensagem referenciada encontrada: wid=${referencedWid}, id=${referencedMessage.id}`);
  return referencedMessage;
};

const extractOfficialReplyContent = (
  message: any
): { body: string; mediaType: string } | null => {
  if (message?.type === "button") {
    return {
      body:
        message.button?.text ||
        message.button?.payload ||
        "🔘 Resposta de botão",
      mediaType: "templateButtonReplyMessage"
    };
  }

  if (message?.type === "interactive" && message?.interactive?.type === "button_reply") {
    return {
      body:
        message.interactive?.button_reply?.title ||
        message.interactive?.button_reply?.id ||
        "🔘 Resposta de botão",
      mediaType: "buttonsResponseMessage"
    };
  }

  if (message?.type === "interactive" && message?.interactive?.type === "list_reply") {
    return {
      body:
        message.interactive?.list_reply?.title ||
        message.interactive?.list_reply?.id ||
        message.interactive?.list_reply?.description ||
        "📋 Opção selecionada",
      mediaType: "listResponseMessage"
    };
  }

  return null;
};

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

    const phoneNumberId = value?.metadata?.phone_number_id;
    if (!phoneNumberId) throw new Error("Webhook oficial sem phone_number_id");
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
      throw new Error(`WhatsApp não encontrado para phoneNumberId: ${phoneNumberId}`);
    }

    const companyId = whatsapp.companyId;

    const failures: Error[] = [];
    // Processar mensagens recebidas
    if (value.messages && value.messages.length > 0) {
      for (const message of value.messages) {
        try {
          await processIncomingMessage(message, whatsapp, companyId, value);
        } catch (error: any) {
          Sentry.captureException(error);
          logger.error(`[WebhookProcessor] Erro ao processar mensagem ${message.id}: ${error.message}`);
          failures.push(error);
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
          failures.push(error);
        }
      }
    }
    if (failures.length) throw failures[0];

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

  // Encontrar ou criar ticket — unreadMessages recebe o total cumulativo
  // (mesmo contrato do wbotMessageListener; cache zera ao marcar como lido)
  let ticket = await FindOrCreateTicketService(
    contact,
    whatsapp,
    await nextUnreadCount(contact.id),
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

  logger.info(`[WebhookProcessor] Ticket ${ticket.id} usado para mensagem de ID Meta (contato=${contact.id})`);

  // Atribuição CTWA: grava adId/headline quando a mensagem veio de anúncio
  await persistCtwaReferral(ticket, message);

  // Processar corpo da mensagem de forma simplificada
  let body = "";
  let mediaType: string | undefined;
  const referencedMessage = await findReferencedOfficialMessage(message, companyId);
  const interactiveReply = extractOfficialReplyContent(message);

  switch (message.type) {
    case "text":
      body = message.text?.body || "";
      mediaType = "conversation";
      break;
    case "button":
    case "interactive":
      body = interactiveReply?.body || `[${message.type}]`;
      mediaType = interactiveReply?.mediaType;
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
      ack: 0,
      quotedMsgId: referencedMessage?.id || null,
      dataJson: serializeOfficialWebhookMessage(message)
    },
    companyId
  });

  logger.info(`[WebhookProcessor] Mensagem criada via fallback: ${createdMessage.id}`);

  // unreadMessages já veio cumulativo do FindOrCreateTicketService
  await ticket.update({ lastMessage: body });
  await UpdateSessionWindow(ticket.id, whatsapp.id, timestamp);

  // Emitir evento via Socket.IO
  // Emissão única: o helper envia para a sala do ticket e, via except(room),
  // para os demais sockets do namespace — evita a dupla entrega anterior
  // (emit na sala + broadcast no namespace atingia quem estava na sala 2x).
  const realtimeTicket = await loadRealtimeTicketPayload(ticket.id);
  await emitToCompanyRoom(companyId, ticket.uuid, `company-${companyId}-appMessage`, {
    action: "create",
    message: createdMessage,
    ticket: realtimeTicket || ticket,
    contact,
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
  // timestamp malformado/missing não pode matar o job (Bull retentaria 8x à toa)
  const tsSec = parseInt(message.timestamp, 10);
  const timestamp = Number.isFinite(tsSec) ? tsSec * 1000 : Date.now();

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
      const fallbackKey = `contact-id-${existingByName.id}-${companyId}`;
      const fallbackLock = getContactLock(fallbackKey);
      try {
        await fallbackLock.runExclusive(async () => {
          const duplicate = await Message.findOne({
            where: { wid: messageId, companyId },
            attributes: ["id"]
          });
          if (!duplicate) {
            await processMessageWithExistingContact(existingByName, message, whatsapp, companyId, value, messageId, timestamp);
          }
        });
      } finally {
        releaseContactLock(fallbackKey, fallbackLock);
      }
      return;
    } else {
      throw new Error(`Não foi possível resolver número real para ID Meta ${from}`);
    }
  }

  // Lock por contato para evitar race conditions
  const lockKey = `contact-${actualPhoneNumber}-${companyId}`;
  const lock = getContactLock(lockKey);

  try {
  await lock.runExclusive(async () => {
    logger.info(`[WebhookProcessor] Lock adquirido para ${lockKey}`);

    const duplicate = await Message.findOne({
      where: { wid: messageId, companyId },
      attributes: ["id"]
    });
    if (duplicate) return;

    // Criar ou atualizar contato
    let contact: Contact | null = null;
    try {
      contact = await CreateOrUpdateContactService({
        name: contactName,
        number: actualPhoneNumber,
        isGroup: false,
        companyId,
        channels: ["whatsapp"],
        whatsappId: whatsapp.id,
        checkProfilePic: true
      });
      logger.info(`[WebhookProcessor] Contato resolvido: id=${contact.id}, number=${contact.number}`);
    } catch (e: any) {
      logger.error(`[WebhookProcessor] Erro ao criar/atualizar contato: ${e.message}`);
      throw e;
    }

    if (!contact) {
      throw new Error("Contato não retornado pelo serviço");
    }

    // Buscar settings da empresa
    const CompaniesSettings = (await import("../../models/CompaniesSettings")).default;
    const settings = await CompaniesSettings.findOne({
      where: { companyId }
    });

    // Encontrar ou criar ticket — unreadMessages recebe o total cumulativo
    // (mesmo contrato do wbotMessageListener; cache zera ao marcar como lido)
    let ticket = await FindOrCreateTicketService(
      contact,
      whatsapp,
      await nextUnreadCount(contact.id),
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

    // Contato respondeu: remove "tag de controle de campanha" (idem Baileys)
    await removeCampaignMarkerTags(ticket.contactId, companyId);

    // Atribuição CTWA: grava adId/headline no ticket quando a mensagem
    // que o originou veio de um anúncio Click-to-WhatsApp
    await persistCtwaReferral(ticket, message);

    // Processar corpo da mensagem
    let body = "";
    let mediaType: string | undefined;
    let mediaUrl: string | undefined;
    const referencedMessage = await findReferencedOfficialMessage(message, companyId);
    const interactiveReply = extractOfficialReplyContent(message);

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
            throw err;
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
            throw err;
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
            throw err;
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
            throw err;
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
            throw err;
          }
        }
        break;

      case "location":
        const lat = message.location?.latitude;
        const lng = message.location?.longitude;
        const locName = message.location?.name || "";
        const description = message.location?.address || "";
        const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
        const staticMapUrl = `https://static-maps.yandex.ru/1.x/?lang=pt_BR&ll=${lng},${lat}&z=16&l=map&size=650,320&pt=${lng},${lat},pm2rdm`;
        body = `${staticMapUrl} | ${mapsLink} | ${description || `${lat}, ${lng}`}`;
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

      case "button":
      case "interactive":
        body = interactiveReply?.body || `[${message.type}]`;
        mediaType = interactiveReply?.mediaType || "interactiveMessage";
        logger.info(`[WebhookProcessor] Resposta interativa recebida: ${body}`);
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
        ack: 0,
        quotedMsgId: referencedMessage?.id || null,
        dataJson: serializeOfficialWebhookMessage(message)
      },
      companyId
    });

    logger.info(`[WebhookProcessor] Mensagem criada: ${createdMessage.id}`);

    // Atualizar ticket — unreadMessages já veio cumulativo do FindOrCreateTicketService
    await ticket.update({
      lastMessage: body,
      updatedAt: new Date()
    });

    // Atualizar janela de sessão de 24h (API Oficial)
    await UpdateSessionWindow(ticket.id, whatsapp.id, timestamp);

    const realtimeTicket = await loadRealtimeTicketPayload(ticket.id);
    if (realtimeTicket) {
      ticket = realtimeTicket as any;
    }

    // AGENDAR renovação automática via Bull Queue
    try {
      const renewalMinutes = whatsapp.sessionWindowRenewalMinutes || 60;
      // O valor gravado por UpdateSessionWindow é monotônico (max) — agenda a
      // partir dele, sem recompute de Date.now() que quebrava em clock skew.
      const expiresAtMs = ticket.sessionWindowExpiresAt
        ? new Date(ticket.sessionWindowExpiresAt).getTime()
        : 0;
      {
        const delayMs = expiresAtMs - renewalMinutes * 60 * 1000 - Date.now();
        const jobId = `window-renewal-${ticket.id}`;
        const existingJob = await sessionWindowRenewalQueue.getJob(jobId);
        if (existingJob) await existingJob.remove();

        if (delayMs > 0) {
          await sessionWindowRenewalQueue.add(
            { ticketId: ticket.id, companyId },
            {
              jobId,
              delay: delayMs,
              attempts: 3,
              backoff: { type: "fixed", delay: 60000 }
            }
          );
          logger.info(`[WebhookProcessor] Renovação de janela agendada para ticket ${ticket.id}`);
        }
      }
    } catch (scheduleError: any) {
      logger.error(
        `[WebhookProcessor] Erro ao agendar renovação de janela para ticket ${ticket.id}: ${scheduleError.message}`
      );
    }

    // Emitir evento via Socket.IO
    // Emissão única: helper envia para a sala do ticket e, via except(room),
    // para os demais sockets do namespace — evita a dupla entrega anterior.
    const io = getIO();
    await emitToCompanyRoom(companyId, ticket.uuid, `company-${companyId}-appMessage`, {
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
    // (echo-prevention já é garantida pelo dedup de wid acima)
    if (ticket.status === "bot" && ticket.queueId) {
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
  } finally {
    releaseContactLock(lockKey, lock);
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

  // CQRS: Usar MessageCommandService para atualizar ACK
  // Isso já faz: busca mensagem + valida ack + update DB + emite evento via EventBus
  const { updateMessageAckByWid } = await import("../MessageServices/MessageCommandService");

  const updatedMessage = await updateMessageAckByWid(messageId, companyId, ack);

  if (updatedMessage) {
    logger.debug(`[WebhookProcessor] Mensagem ${messageId} atualizada para ack=${ack} via CQRS`);
  } else {
    // Status de mensagem que não existe (enviada antes do wid ser persistido,
    // ou purgada): warn e segue — lançar erro aqui jogaria o change inteiro
    // para dead-letter após 8 retentativas inúteis.
    logger.warn(`[WebhookProcessor] Mensagem ${messageId} não encontrada para ACK da empresa ${companyId}`);
  }

  // Reconciliar CampaignShipping: o wid gravado no dispatch permite refletir
  // o status real da Meta (delivered/read/failed) no relatório da campanha.
  try {
    const shipping = await CampaignShipping.findOne({
      where: { wid: messageId }
    });
    if (shipping) {
      const update: Record<string, any> = { metaStatus: ackStatus };
      if (ackStatus === "delivered") {
        update.deliveredAt = status.timestamp
          ? new Date(Number(status.timestamp) * 1000)
          : new Date();
      }
      if (ackStatus === "read") {
        update.readAt = status.timestamp
          ? new Date(Number(status.timestamp) * 1000)
          : new Date();
      }
      if (ackStatus === "failed") {
        update.status = "failed";
        update.lastError =
          status.errors?.[0]?.title ||
          status.errors?.[0]?.code ||
          "Falha reportada pela Meta";
      }
      await shipping.update(update);
      logger.debug(
        `[WebhookProcessor] CampaignShipping #${shipping.id} reconciliado: metaStatus=${ackStatus}`
      );
    }
  } catch (err: any) {
    logger.warn(
      `[WebhookProcessor] Erro ao reconciliar CampaignShipping do wid ${messageId}: ${err.message}`
    );
  }
}

export default ProcessWhatsAppWebhook;
