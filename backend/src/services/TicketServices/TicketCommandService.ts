import { Op } from "sequelize";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import User from "../../models/User";
import Queue from "../../models/Queue";
import logger from "../../utils/logger";
import { ticketEventBus } from "./TicketEventBus";
import cacheLayer from "../../libs/cache";

// CQRS: Command Service para operações de escrita em Tickets
// Todas as operações de escrita passam por aqui para garantir consistência

// Cache keys
const TICKET_CACHE_PREFIX = "ticket:";
const TICKET_CACHE_TTL = 300; // 5 minutos

// Invalida cache de ticket
function invalidateTicketCache(ticketId: number): void {
  try {
    cacheLayer.del(`${TICKET_CACHE_PREFIX}${ticketId}`);
  } catch (err) {
    logger.warn(`[TicketCommandService] Falha ao invalidar cache do ticket ${ticketId}:`, err);
  }
}

// Interface para criação de ticket
export interface CreateTicketCommand {
  contactId: number;
  companyId: number;
  whatsappId?: number;
  status?: string;
  queueId?: number;
  userId?: number;
  isGroup?: boolean;
  channel?: string;
  lastMessage?: string;
}

// Interface para atualização de ticket
export interface UpdateTicketCommand {
  status?: string;
  userId?: number | null;
  queueId?: number | null;
  isBot?: boolean;
  lastMessage?: string;
  unreadMessages?: number;
  useIntegration?: boolean;
  integrationId?: number;
}

// Cria um novo ticket e emite evento
export async function createTicket(command: CreateTicketCommand): Promise<Ticket> {
  const ticket = await Ticket.create({
    contactId: command.contactId,
    companyId: command.companyId,
    whatsappId: command.whatsappId,
    status: command.status || "pending",
    queueId: command.queueId,
    userId: command.userId,
    isGroup: command.isGroup || false,
    channel: command.channel || "whatsapp",
    lastMessage: command.lastMessage || ""
  });

  // Recarregar com associações
  await ticket.reload({
    include: [
      { model: Contact, as: "contact" },
      { model: Whatsapp, as: "whatsapp" },
      { model: User, as: "user" },
      { model: Queue, as: "queue" }
    ]
  });

  // Publicar evento
  ticketEventBus.publishTicketCreated(
    ticket.companyId,
    ticket.id,
    ticket.uuid,
    ticket,
    ticket.contact
  );

  logger.debug(`[TicketCommandService] Ticket ${ticket.id} criado via CQRS`);

  return ticket;
}

// Atualiza um ticket e emite evento
export async function updateTicket(
  ticketId: number,
  companyId: number,
  updates: UpdateTicketCommand
): Promise<Ticket | null> {
  const ticket = await Ticket.findOne({
    where: { id: ticketId, companyId },
    include: [
      { model: Contact, as: "contact" },
      { model: Whatsapp, as: "whatsapp" },
      { model: User, as: "user" },
      { model: Queue, as: "queue" }
    ]
  });

  if (!ticket) {
    logger.warn(`[TicketCommandService] Ticket ${ticketId} não encontrado`);
    return null;
  }

  const oldStatus = ticket.status;

  // Aplicar updates
  await ticket.update(updates);
  
  // Recarrega com associações para emitir evento Socket.IO completo
  await ticket.reload({
    include: [
      { model: Contact, as: "contact" },
      { model: Whatsapp, as: "whatsapp" },
      { model: User, as: "user" },
      { model: Queue, as: "queue" }
    ]
  });

  // Invalidar cache
  invalidateTicketCache(ticketId);

  // Publicar evento apropriado
  if (updates.status && updates.status !== oldStatus) {
    ticketEventBus.publishStatusChanged(
      companyId,
      ticket.id,
      ticket.uuid,
      ticket,
      oldStatus,
      updates.status
    );
  } else {
    ticketEventBus.publishTicketUpdated(
      companyId,
      ticket.id,
      ticket.uuid,
      ticket
    );
  }

  logger.debug(`[TicketCommandService] Ticket ${ticketId} atualizado via CQRS`);

  return ticket;
}

// Atualiza status do ticket e emite evento
export async function updateTicketStatus(
  ticketId: number,
  companyId: number,
  newStatus: string
): Promise<Ticket | null> {
  return updateTicket(ticketId, companyId, { status: newStatus });
}

// Fecha um ticket e emite evento
export async function closeTicket(
  ticketId: number,
  companyId: number
): Promise<Ticket | null> {
  const ticket = await Ticket.findOne({
    where: { id: ticketId, companyId },
    include: [
      { model: Contact, as: "contact" },
      { model: Whatsapp, as: "whatsapp" }
    ]
  });

  if (!ticket) {
    return null;
  }

  const oldStatus = ticket.status;

  await ticket.update({
    status: "closed",
    lastFlowId: null,
    dataWebhook: null,
    hashFlowId: null
  });

  // Recarrega com associações para emitir evento Socket.IO completo
  await ticket.reload({
    include: [
      { model: Contact, as: "contact" },
      { model: Whatsapp, as: "whatsapp" },
      { model: User, as: "user" },
      { model: Queue, as: "queue" }
    ]
  });

  // Invalidar cache
  invalidateTicketCache(ticketId);

  // Publicar evento de status changed
  ticketEventBus.publishStatusChanged(
    companyId,
    ticket.id,
    ticket.uuid,
    ticket,
    oldStatus,
    "closed"
  );

  logger.debug(`[TicketCommandService] Ticket ${ticketId} fechado via CQRS`);

  return ticket;
}

// Deleta um ticket e emite evento
export async function deleteTicket(
  ticketId: number,
  companyId: number
): Promise<boolean> {
  const ticket = await Ticket.findOne({
    where: { id: ticketId, companyId }
  });

  if (!ticket) {
    return false;
  }

  const uuid = ticket.uuid;

  await ticket.destroy();

  // Invalidar cache
  invalidateTicketCache(ticketId);

  // Publicar evento
  ticketEventBus.publishTicketDeleted(companyId, ticketId, uuid);

  logger.debug(`[TicketCommandService] Ticket ${ticketId} deletado via CQRS`);

  return true;
}

// Atribui usuário ao ticket
export async function assignTicketToUser(
  ticketId: number,
  companyId: number,
  userId: number
): Promise<Ticket | null> {
  return updateTicket(ticketId, companyId, { userId, status: "open" });
}

// Remove usuário do ticket (volta para fila)
export async function unassignTicketFromUser(
  ticketId: number,
  companyId: number
): Promise<Ticket | null> {
  return updateTicket(ticketId, companyId, { userId: null, status: "pending" });
}

// Transfere ticket para outra fila
export async function transferTicketToQueue(
  ticketId: number,
  companyId: number,
  queueId: number,
  userId?: number
): Promise<Ticket | null> {
  const updates: UpdateTicketCommand = { queueId };
  if (userId !== undefined) {
    updates.userId = userId;
    updates.status = "open";
  } else {
    updates.status = "pending";
  }
  return updateTicket(ticketId, companyId, updates);
}

// Atualiza contagem de mensagens não lidas
export async function updateUnreadCount(
  ticketId: number,
  companyId: number,
  ticketUuid: string,
  unreadCount: number
): Promise<void> {
  await Ticket.update(
    { unreadMessages: unreadCount },
    { where: { id: ticketId, companyId } }
  );

  // Invalidar cache
  invalidateTicketCache(ticketId);

  // Publicar evento
  ticketEventBus.publishUnreadUpdated(companyId, ticketId, ticketUuid, unreadCount);

  logger.debug(`[TicketCommandService] Ticket ${ticketId} unread count atualizado para ${unreadCount}`);
}

// Zera contagem de mensagens não lidas
export async function clearUnreadCount(
  ticketId: number,
  companyId: number,
  ticketUuid: string
): Promise<void> {
  await updateUnreadCount(ticketId, companyId, ticketUuid, 0);
}

// Atualiza última mensagem do ticket
export async function updateLastMessage(
  ticketId: number,
  companyId: number,
  lastMessage: string
): Promise<void> {
  await Ticket.update(
    { lastMessage },
    { where: { id: ticketId, companyId } }
  );

  // Invalidar cache
  invalidateTicketCache(ticketId);

  logger.debug(`[TicketCommandService] Ticket ${ticketId} lastMessage atualizado`);
}

// Emite evento de ticket atualizado (para uso externo quando update é feito fora do service)
export function emitTicketUpdated(
  companyId: number,
  ticketId: number,
  ticketUuid: string,
  ticket: any
): void {
  ticketEventBus.publishTicketUpdated(companyId, ticketId, ticketUuid, ticket);
}

// Emite evento de ticket deletado (para uso externo)
export function emitTicketDeleted(
  companyId: number,
  ticketId: number,
  ticketUuid: string
): void {
  ticketEventBus.publishTicketDeleted(companyId, ticketId, ticketUuid);
}

export default {
  createTicket,
  updateTicket,
  updateTicketStatus,
  closeTicket,
  deleteTicket,
  assignTicketToUser,
  unassignTicketFromUser,
  transferTicketToQueue,
  updateUnreadCount,
  clearUnreadCount,
  updateLastMessage,
  emitTicketUpdated,
  emitTicketDeleted
};
