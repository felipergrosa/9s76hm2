import { Op, Sequelize } from "sequelize";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import User from "../../models/User";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";
import logger from "../../utils/logger";
import cacheLayer from "../../libs/cache";

// CQRS: Query Service para operações de leitura em Tickets
// Otimizado com cache para alta performance

// Cache keys
const TICKET_CACHE_PREFIX = "ticket:";
const TICKET_CACHE_TTL = 300; // 5 minutos

// Include padrão para tickets
const DEFAULT_INCLUDES = [
  { model: Contact, as: "contact", attributes: ["id", "name", "number", "profilePicUrl"] },
  { model: Whatsapp, as: "whatsapp", attributes: ["id", "name", "status", "channelType"] },
  { model: User, as: "user", attributes: ["id", "name", "email"] },
  { model: Queue, as: "queue", attributes: ["id", "name", "color"] }
];

// Interface para filtros de listagem
export interface ListTicketsFilter {
  companyId: number;
  status?: string | string[];
  userId?: number;
  queueIds?: number[];
  isGroup?: boolean;
  withUnreadMessages?: boolean;
  searchParam?: string;
  date?: string;
  showAll?: boolean;
  limit?: number;
  offset?: number;
}

// Interface para resultado de listagem
export interface ListTicketsResult {
  tickets: Ticket[];
  count: number;
  hasMore: boolean;
}

// Busca ticket por ID com cache
export async function findById(
  ticketId: number,
  companyId: number,
  useCache: boolean = true
): Promise<Ticket | null> {
  const cacheKey = `${TICKET_CACHE_PREFIX}${ticketId}`;

  // Tentar cache primeiro
  if (useCache) {
    try {
      const cached = await cacheLayer.get(cacheKey);
      if (cached) {
        logger.debug(`[TicketQueryService] Ticket ${ticketId} encontrado no cache`);
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn(`[TicketQueryService] Erro ao ler cache:`, err);
    }
  }

  const ticket = await Ticket.findOne({
    where: { id: ticketId, companyId },
    include: DEFAULT_INCLUDES
  });

  // Salvar no cache
  if (ticket && useCache) {
    try {
      await cacheLayer.set(cacheKey, JSON.stringify(ticket), "EX", TICKET_CACHE_TTL);
    } catch (err) {
      logger.warn(`[TicketQueryService] Erro ao salvar cache:`, err);
    }
  }

  return ticket;
}

// Busca ticket por UUID
export async function findByUuid(
  uuid: string,
  companyId: number
): Promise<Ticket | null> {
  return Ticket.findOne({
    where: { uuid, companyId },
    include: DEFAULT_INCLUDES
  });
}

// Busca ticket por contato
export async function findByContact(
  contactId: number,
  companyId: number,
  status?: string | string[]
): Promise<Ticket | null> {
  const where: any = { contactId, companyId };
  
  if (status) {
    where.status = Array.isArray(status) ? { [Op.in]: status } : status;
  }

  return Ticket.findOne({
    where,
    include: DEFAULT_INCLUDES,
    order: [["updatedAt", "DESC"]]
  });
}

// Busca ticket aberto por contato e whatsapp
export async function findOpenByContactAndWhatsapp(
  contactId: number,
  whatsappId: number,
  companyId: number
): Promise<Ticket | null> {
  return Ticket.findOne({
    where: {
      contactId,
      whatsappId,
      companyId,
      status: { [Op.in]: ["open", "pending", "bot", "group"] }
    },
    include: DEFAULT_INCLUDES
  });
}

// Lista tickets com filtros
export async function listTickets(filter: ListTicketsFilter): Promise<ListTicketsResult> {
  const {
    companyId,
    status,
    userId,
    queueIds,
    isGroup,
    withUnreadMessages,
    searchParam,
    limit = 40,
    offset = 0
  } = filter;

  const where: any = { companyId };

  // Filtro por status
  if (status) {
    where.status = Array.isArray(status) ? { [Op.in]: status } : status;
  }

  // Filtro por usuário
  if (userId) {
    where.userId = userId;
  }

  // Filtro por filas
  if (queueIds && queueIds.length > 0) {
    where.queueId = { [Op.in]: queueIds };
  }

  // Filtro por grupo
  if (isGroup !== undefined) {
    where.isGroup = isGroup;
  }

  // Filtro por mensagens não lidas
  if (withUnreadMessages) {
    where.unreadMessages = { [Op.gt]: 0 };
  }

  // Busca por termo
  if (searchParam) {
    where[Op.or] = [
      { "$contact.name$": { [Op.like]: `%${searchParam}%` } },
      { "$contact.number$": { [Op.like]: `%${searchParam}%` } },
      { lastMessage: { [Op.like]: `%${searchParam}%` } }
    ];
  }

  const { rows: tickets, count } = await Ticket.findAndCountAll({
    where,
    include: DEFAULT_INCLUDES,
    order: [["updatedAt", "DESC"]],
    limit,
    offset,
    subQuery: false
  });

  return {
    tickets,
    count,
    hasMore: count > offset + tickets.length
  };
}

// Conta tickets por status
export async function countByStatus(
  companyId: number,
  status: string
): Promise<number> {
  return Ticket.count({
    where: { companyId, status }
  });
}

// Conta tickets por usuário
export async function countByUser(
  companyId: number,
  userId: number,
  status?: string
): Promise<number> {
  const where: any = { companyId, userId };
  if (status) {
    where.status = status;
  }
  return Ticket.count({ where });
}

// Conta total de mensagens não lidas
export async function countTotalUnread(
  companyId: number,
  userId?: number,
  queueIds?: number[]
): Promise<number> {
  const where: any = {
    companyId,
    unreadMessages: { [Op.gt]: 0 },
    status: { [Op.notIn]: ["closed"] }
  };

  if (userId) {
    where[Op.or] = [
      { userId },
      { userId: null }
    ];
  }

  if (queueIds && queueIds.length > 0) {
    where.queueId = { [Op.in]: queueIds };
  }

  const result = await Ticket.findOne({
    where,
    attributes: [[Sequelize.fn("SUM", Sequelize.col("unreadMessages")), "total"]]
  });

  return (result?.get("total") as number) || 0;
}

// Busca tickets pendentes (para atribuição)
export async function findPendingTickets(
  companyId: number,
  queueIds?: number[],
  limit: number = 10
): Promise<Ticket[]> {
  const where: any = {
    companyId,
    status: "pending",
    userId: null
  };

  if (queueIds && queueIds.length > 0) {
    where.queueId = { [Op.in]: queueIds };
  }

  return Ticket.findAll({
    where,
    include: DEFAULT_INCLUDES,
    order: [["updatedAt", "ASC"]], // Mais antigos primeiro
    limit
  });
}

// Busca tickets do usuário
export async function findUserTickets(
  companyId: number,
  userId: number,
  status?: string | string[]
): Promise<Ticket[]> {
  const where: any = { companyId, userId };

  if (status) {
    where.status = Array.isArray(status) ? { [Op.in]: status } : status;
  }

  return Ticket.findAll({
    where,
    include: DEFAULT_INCLUDES,
    order: [["updatedAt", "DESC"]]
  });
}

// Busca tickets com tags específicas
export async function findByTags(
  companyId: number,
  tagIds: number[],
  status?: string
): Promise<Ticket[]> {
  const where: any = { companyId };
  if (status) {
    where.status = status;
  }

  return Ticket.findAll({
    where,
    include: [
      ...DEFAULT_INCLUDES,
      {
        model: Tag,
        as: "tags",
        where: { id: { [Op.in]: tagIds } },
        through: { attributes: [] }
      }
    ]
  });
}

// Verifica se ticket existe
export async function exists(
  ticketId: number,
  companyId: number
): Promise<boolean> {
  const count = await Ticket.count({
    where: { id: ticketId, companyId }
  });
  return count > 0;
}

// Estatísticas rápidas de tickets
export async function getQuickStats(companyId: number): Promise<{
  pending: number;
  open: number;
  closed: number;
  groups: number;
  totalUnread: number;
}> {
  const [pending, open, closed, groups, totalUnread] = await Promise.all([
    countByStatus(companyId, "pending"),
    countByStatus(companyId, "open"),
    countByStatus(companyId, "closed"),
    countByStatus(companyId, "group"),
    countTotalUnread(companyId)
  ]);

  return { pending, open, closed, groups, totalUnread };
}

export default {
  findById,
  findByUuid,
  findByContact,
  findOpenByContactAndWhatsapp,
  listTickets,
  countByStatus,
  countByUser,
  countTotalUnread,
  findPendingTickets,
  findUserTickets,
  findByTags,
  exists,
  getQuickStats
};
