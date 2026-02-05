import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import User from "../../models/User";
import Tag from "../../models/Tag";
import logger from "../../utils/logger";
import { messageEventBus } from "./MessageEventBus";
import { invalidateTicketCache } from "./MessageQueryService";

// CQRS Básico: Serviço de Command para escrita de mensagens
// Separado do serviço de leitura (Query) para melhor organização

export interface CreateMessageCommand {
  wid: string;
  ticketId: number;
  companyId: number;
  body: string;
  contactId?: number;
  fromMe?: boolean;
  read?: boolean;
  mediaType?: string;
  mediaUrl?: string;
  ack?: number;
  queueId?: number;
  channel?: string;
  ticketTrakingId?: number;
  isPrivate?: boolean;
  ticketImported?: any;
  isForwarded?: boolean;
  remoteJid?: string | null;
  dataJson?: string;
  isCampaign?: boolean;
  senderName?: string;
}

export interface UpdateMessageCommand {
  messageId: number;
  companyId: number;
  updates: Partial<{
    body: string;
    ack: number;
    read: boolean;
    isDeleted: boolean;
  }>;
}

// Cria uma nova mensagem (Command)
export async function createMessage(command: CreateMessageCommand): Promise<Message> {
  const { companyId, ticketId, ...messageData } = command;

  // Validação de integridade
  if (messageData.contactId) {
    const ticketCheck = await Ticket.findByPk(ticketId, { attributes: ["id", "contactId"] });
    if (ticketCheck && ticketCheck.contactId !== messageData.contactId) {
      logger.error("[MessageCommandService] ALERTA DE INTEGRIDADE: ticket.contactId !== messageData.contactId", {
        ticketId,
        ticketContactId: ticketCheck.contactId,
        messageContactId: messageData.contactId
      });
    }
  }

  // Upsert da mensagem
  await Message.upsert({ ...messageData, ticketId, companyId });

  // Busca mensagem criada com relacionamentos
  const message = await Message.findOne({
    where: { wid: messageData.wid, companyId },
    include: [
      "contact",
      {
        model: Ticket,
        as: "ticket",
        include: [
          {
            model: Contact,
            attributes: ["id", "name", "number", "email", "profilePicUrl", "acceptAudioMessage", "active", "urlPicture", "companyId"],
            include: ["extraInfo", "tags"]
          },
          { model: Queue, attributes: ["id", "name", "color"] },
          { model: Whatsapp, attributes: ["id", "name", "groupAsTicket", "greetingMediaAttachment", "facebookUserToken", "facebookUserId"] },
          { model: User, as: "user", attributes: ["id", "name"] },
          { model: Tag, as: "tags", attributes: ["id", "name", "color"] }
        ]
      }
    ]
  });

  if (!message) {
    throw new Error("ERR_CREATING_MESSAGE");
  }

  // Atualizar queueId se necessário
  if (message.ticket.queueId !== null && message.queueId === null) {
    await message.update({ queueId: message.ticket.queueId });
  }

  // Tratar mensagem privada
  if (message.isPrivate) {
    await message.update({ wid: `PVT${message.id}` });
  }

  // Atualizar lastMessage do ticket
  if (!message.isPrivate && message.body) {
    await message.ticket.update({
      lastMessage: message.body,
      updatedAt: new Date()
    });
  }

  // Invalidar cache
  invalidateTicketCache(ticketId);

  // Publicar evento (CQRS)
  if (!command.ticketImported) {
    messageEventBus.publishMessageCreated(
      companyId,
      ticketId,
      message.ticket.uuid,
      message.id,
      message,
      message.ticket,
      message.ticket.contact
    );
  }

  logger.debug(`[MessageCommandService] Mensagem criada: ${message.id} no ticket ${ticketId}`);

  return message;
}

// Atualiza uma mensagem existente (Command)
export async function updateMessage(command: UpdateMessageCommand): Promise<Message | null> {
  const { messageId, companyId, updates } = command;

  const message = await Message.findOne({
    where: { id: messageId, companyId },
    include: [
      {
        model: Ticket,
        as: "ticket",
        attributes: ["id", "uuid"]
      }
    ]
  });

  if (!message) {
    logger.warn(`[MessageCommandService] Mensagem ${messageId} não encontrada`);
    return null;
  }

  await message.update(updates);

  // Invalidar cache
  invalidateTicketCache(message.ticketId);

  // Publicar evento de atualização
  messageEventBus.publishMessageUpdated(
    companyId,
    message.ticketId,
    message.ticket.uuid,
    message.id,
    message
  );

  logger.debug(`[MessageCommandService] Mensagem ${messageId} atualizada`);

  return message;
}

// Atualiza ACK de uma mensagem (Command específico)
export async function updateMessageAck(
  messageId: number,
  companyId: number,
  ack: number
): Promise<Message | null> {
  const message = await Message.findOne({
    where: { id: messageId, companyId },
    include: [
      {
        model: Ticket,
        as: "ticket",
        attributes: ["id", "uuid"]
      }
    ]
  });

  if (!message) {
    return null;
  }

  // Só atualiza se o novo ACK for maior
  if (message.ack >= ack) {
    return message;
  }

  await message.update({ ack });

  // Publicar evento de ACK
  messageEventBus.publishAckUpdated(
    companyId,
    message.ticketId,
    message.ticket.uuid,
    message.id,
    message
  );

  return message;
}

// Marca mensagem como deletada (soft delete)
export async function deleteMessage(
  messageId: number,
  companyId: number
): Promise<boolean> {
  const message = await Message.findOne({
    where: { id: messageId, companyId },
    include: [
      {
        model: Ticket,
        as: "ticket",
        attributes: ["id", "uuid"]
      }
    ]
  });

  if (!message) {
    return false;
  }

  await message.update({ isDeleted: true });

  // Invalidar cache
  invalidateTicketCache(message.ticketId);

  // Publicar evento de deleção
  messageEventBus.publishMessageDeleted(
    companyId,
    message.ticketId,
    message.ticket.uuid,
    message.id
  );

  logger.debug(`[MessageCommandService] Mensagem ${messageId} deletada`);

  return true;
}

export default {
  createMessage,
  updateMessage,
  updateMessageAck,
  deleteMessage
};
