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
import { safeNormalizePhoneNumber } from "../../utils/phone";
import { UpdateSessionWindow } from "../TicketServices/UpdateSessionWindowService";

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
  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .to(ticket.uuid)
    .emit(`company-${companyId}-appMessage`, {
      action: "create",
      message: createdMessage,
      ticket,
      contact
    });
}

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
  let actualPhoneNumber = from;

  if (value.contacts && value.contacts.length > 0) {
    // Primeiro, tentar encontrar o contato pelo from
    let contactInfo = value.contacts.find((c: any) => c.wa_id === from);

    // Se não encontrou pelo from, pegar o primeiro contato disponível
    if (!contactInfo && value.contacts[0]) {
      contactInfo = value.contacts[0];
    }

    if (contactInfo) {
      // Extrair nome do perfil
      if (contactInfo.profile && contactInfo.profile.name) {
        contactName = contactInfo.profile.name;
      }

      // CRÍTICO: Usar wa_id como número real (é o telefone correto!)
      // O wa_id sempre contém o número de telefone real, mesmo quando message.from é um ID Meta
      if (contactInfo.wa_id) {
        const { canonical } = safeNormalizePhoneNumber(contactInfo.wa_id);
        // Validar se wa_id parece um número de telefone válido
        if (canonical) {
          actualPhoneNumber = canonical;
          logger.info(`[WebhookProcessor] Usando wa_id real normalizado: ${actualPhoneNumber} (message.from era: ${from})`);
        }
      }
    }
  }

  // Verificar se o número ainda é um ID Meta (> 13 dígitos para BR, mas libphonenumber cuida disso)
  const { canonical: finalCanonical } = safeNormalizePhoneNumber(actualPhoneNumber);
  const isMetaId = !finalCanonical && actualPhoneNumber.replace(/\D/g, "").length > 13;

  if (isMetaId) {
    logger.warn(`[WebhookProcessor] Número ${actualPhoneNumber} parece ser ID Meta. Tentando fallback...`);

    // Tentar encontrar contato existente pelo nome
    const existingByName = await Contact.findOne({
      where: {
        name: contactName,
        companyId,
        isGroup: false
      }
    });

    if (existingByName) {
      logger.info(`[WebhookProcessor] Contato encontrado pelo nome "${contactName}" (id=${existingByName.id}), evitando duplicata`);
      // Usar o contato existente diretamente
      await processMessageWithExistingContact(existingByName, message, whatsapp, companyId, value, messageId, timestamp);
      return;
    } else {
      // Não conseguimos resolver o número real, ignorar mensagem
      logger.error(`[WebhookProcessor] REJEITADO: Não foi possível resolver número real para ID Meta ${from}. Mensagem ignorada.`, {
        from,
        actualPhoneNumber,
        contactName,
        phoneDigitsLength: actualPhoneNumber.replace(/\D/g, "").length
      });
      return;
    }
  }

  // Criar ou atualizar contato (com número válido)
  let contact: Contact | null = null;
  try {
    contact = await CreateOrUpdateContactService({
      name: contactName,
      number: actualPhoneNumber,  // Usar número corrigido!
      isGroup: false,
      companyId,
      whatsappId: whatsapp.id
    });

    if (!contact) {
      logger.error(`[WebhookProcessor] CreateOrUpdateContactService retornou null para número ${actualPhoneNumber}`);
      return;
    }
  } catch (error: any) {
    logger.error(`[WebhookProcessor] Erro ao criar/atualizar contato ${actualPhoneNumber}: ${error.message}`);
    Sentry.captureException(error);
    return;
  }

  logger.info(`[WebhookProcessor] Contato criado/atualizado: id=${contact.id}, nome=${contact.name}`);


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

    // REGRA UNIFICADA: Se não tem bot, vai para PENDING (Aguardando), não para OPEN
    const newStatus = shouldGoBot ? "bot" : "pending";

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

  // Atualizar janela de sessão de 24h (API Oficial)
  // Quando o cliente envia uma mensagem, abre-se uma janela de 24h para responder gratuitamente
  await UpdateSessionWindow(ticket.id, whatsapp.id);

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
