import Message from "../../models/Message";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import User from "../../models/User";
import Tag from "../../models/Tag";
import { Op } from "sequelize";
import logger from "../../utils/logger";

// CQRS Básico: Serviço de Query para leitura de mensagens
// Separado do serviço de escrita (Command) para melhor performance e escalabilidade

interface ListMessagesParams {
  ticketId: number;
  companyId: number;
  pageNumber?: number;
  pageSize?: number;
  selectedQueues?: number[];
}

interface ListMessagesResult {
  messages: Message[];
  ticket: Ticket | null;
  count: number;
  hasMore: boolean;
}

// Cache simples em memória para reduzir queries repetitivas
const messageCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 5000; // 5 segundos de cache

function getCacheKey(ticketId: number, pageNumber: number): string {
  return `messages-${ticketId}-${pageNumber}`;
}

function getFromCache(key: string): any | null {
  const cached = messageCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  messageCache.delete(key);
  return null;
}

function setCache(key: string, data: any): void {
  // Limita tamanho do cache
  if (messageCache.size > 1000) {
    const firstKey = messageCache.keys().next().value;
    if (firstKey) messageCache.delete(firstKey);
  }
  messageCache.set(key, { data, timestamp: Date.now() });
}

// Invalida cache de um ticket
export function invalidateTicketCache(ticketId: number): void {
  for (const key of messageCache.keys()) {
    if (key.startsWith(`messages-${ticketId}-`)) {
      messageCache.delete(key);
    }
  }
}

// Lista mensagens de um ticket (Query otimizada)
export async function listMessages({
  ticketId,
  companyId,
  pageNumber = 1,
  pageSize = 20,
  selectedQueues = []
}: ListMessagesParams): Promise<ListMessagesResult> {
  const cacheKey = getCacheKey(ticketId, pageNumber);
  
  // Tenta usar cache para página 1 (mais comum)
  if (pageNumber === 1) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      logger.debug(`[MessageQueryService] Cache hit para ticket ${ticketId}`);
      return cached;
    }
  }

  const offset = (pageNumber - 1) * pageSize;

  // Query otimizada com índices
  const { count, rows: messages } = await Message.findAndCountAll({
    where: {
      ticketId,
      companyId
    },
    include: [
      "contact",
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ],
    order: [["createdAt", "DESC"]],
    limit: pageSize,
    offset
  });

  // Busca ticket separadamente (mais eficiente)
  const ticket = await Ticket.findByPk(ticketId, {
    include: [
      {
        model: Contact,
        attributes: ["id", "name", "number", "email", "profilePicUrl", "acceptAudioMessage", "active", "urlPicture", "companyId"],
        include: ["extraInfo", "tags"]
      },
      {
        model: Queue,
        attributes: ["id", "name", "color"]
      },
      {
        model: Whatsapp,
        attributes: ["id", "name", "groupAsTicket", "greetingMediaAttachment", "facebookUserToken", "facebookUserId"]
      },
      {
        model: User,
        as: "user",
        attributes: ["id", "name"]
      },
      {
        model: Tag,
        as: "tags",
        attributes: ["id", "name", "color"]
      }
    ]
  });

  const result = {
    messages: messages.reverse(), // Inverter para ordem cronológica
    ticket,
    count,
    hasMore: offset + messages.length < count
  };

  // Cache apenas página 1
  if (pageNumber === 1) {
    setCache(cacheKey, result);
  }

  return result;
}

// Busca mensagem por ID (Query simples)
export async function getMessageById(
  messageId: number,
  companyId: number
): Promise<Message | null> {
  return Message.findOne({
    where: {
      id: messageId,
      companyId
    },
    include: [
      "contact",
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ]
  });
}

// Busca mensagens mais recentes que um ID (para recuperação)
export async function getMessagesSinceId(
  ticketId: number,
  sinceId: number,
  limit: number = 100
): Promise<Message[]> {
  return Message.findAll({
    where: {
      ticketId,
      id: { [Op.gt]: sinceId }
    },
    include: ["contact"],
    order: [["id", "ASC"]],
    limit
  });
}

// Conta mensagens não lidas
export async function countUnreadMessages(
  ticketId: number,
  companyId: number
): Promise<number> {
  return Message.count({
    where: {
      ticketId,
      companyId,
      read: false,
      fromMe: false
    }
  });
}

export default {
  listMessages,
  getMessageById,
  getMessagesSinceId,
  countUnreadMessages,
  invalidateTicketCache
};
