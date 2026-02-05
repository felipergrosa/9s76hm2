import cache from "../../libs/cache";
import logger from "../../utils/logger";

// TTL padrão: 5 minutos para mensagens recentes
const MESSAGE_CACHE_TTL = 300;
// TTL para lista de mensagens de um ticket: 2 minutos
const TICKET_MESSAGES_TTL = 120;

interface CachedMessage {
  id: number;
  fromMe: boolean;
  mediaUrl: string | null;
  body: string;
  mediaType: string;
  ack: number;
  createdAt: string;
  ticketId: number;
  isDeleted: boolean;
  queueId: number | null;
  isForwarded: boolean;
  isEdited: boolean;
  isPrivate: boolean;
  companyId: number;
  dataJson: any;
  audioTranscription: string | null;
  contact?: {
    id: number;
    name: string;
    profilePicUrl: string | null;
  };
  quotedMsg?: any;
}

// Gera chave única para cache de mensagem individual
const getMessageKey = (companyId: number, messageId: number): string => {
  return `msg:${companyId}:${messageId}`;
};

// Gera chave para lista de mensagens de um ticket
const getTicketMessagesKey = (companyId: number, ticketId: number, page: number): string => {
  return `ticket_msgs:${companyId}:${ticketId}:p${page}`;
};

// Gera chave para última mensagem de um ticket
const getLastMessageKey = (companyId: number, ticketId: number): string => {
  return `last_msg:${companyId}:${ticketId}`;
};

/**
 * Armazena uma mensagem no cache
 */
export const cacheMessage = async (message: CachedMessage): Promise<void> => {
  try {
    const key = getMessageKey(message.companyId, message.id);
    await cache.set(key, JSON.stringify(message), "EX", MESSAGE_CACHE_TTL);
  } catch (err) {
    logger.debug(`[MessageCache] Erro ao cachear mensagem: ${err}`);
  }
};

/**
 * Busca uma mensagem do cache
 */
export const getCachedMessage = async (
  companyId: number,
  messageId: number
): Promise<CachedMessage | null> => {
  try {
    const key = getMessageKey(companyId, messageId);
    const cached = await cache.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    logger.debug(`[MessageCache] Erro ao buscar mensagem do cache: ${err}`);
  }
  return null;
};

/**
 * Armazena lista de mensagens de um ticket no cache
 */
export const cacheTicketMessages = async (
  companyId: number,
  ticketId: number,
  page: number,
  messages: CachedMessage[],
  count: number,
  hasMore: boolean
): Promise<void> => {
  try {
    const key = getTicketMessagesKey(companyId, ticketId, page);
    const data = { messages, count, hasMore, cachedAt: Date.now() };
    await cache.set(key, JSON.stringify(data), "EX", TICKET_MESSAGES_TTL);
    
    // Também cacheia mensagens individuais
    for (const msg of messages) {
      await cacheMessage(msg);
    }
  } catch (err) {
    logger.debug(`[MessageCache] Erro ao cachear lista de mensagens: ${err}`);
  }
};

/**
 * Busca lista de mensagens de um ticket do cache
 */
export const getCachedTicketMessages = async (
  companyId: number,
  ticketId: number,
  page: number
): Promise<{ messages: CachedMessage[]; count: number; hasMore: boolean } | null> => {
  try {
    const key = getTicketMessagesKey(companyId, ticketId, page);
    const cached = await cache.get(key);
    if (cached) {
      const data = JSON.parse(cached);
      // Verifica se cache não está muito antigo (max 2 min)
      if (Date.now() - data.cachedAt < TICKET_MESSAGES_TTL * 1000) {
        logger.debug(`[MessageCache] HIT lista mensagens ticket ${ticketId} page ${page}`);
        return { messages: data.messages, count: data.count, hasMore: data.hasMore };
      }
    }
  } catch (err) {
    logger.debug(`[MessageCache] Erro ao buscar lista do cache: ${err}`);
  }
  return null;
};

/**
 * Invalida cache de mensagens de um ticket (quando nova mensagem chega)
 */
export const invalidateTicketMessagesCache = async (
  companyId: number,
  ticketId: number
): Promise<void> => {
  try {
    // Remove todas as páginas cacheadas do ticket
    const pattern = `ticket_msgs:${companyId}:${ticketId}:*`;
    await cache.delFromPattern(pattern);
    logger.debug(`[MessageCache] Cache invalidado para ticket ${ticketId}`);
  } catch (err) {
    logger.debug(`[MessageCache] Erro ao invalidar cache: ${err}`);
  }
};

/**
 * Atualiza última mensagem de um ticket no cache
 */
export const cacheLastMessage = async (
  companyId: number,
  ticketId: number,
  message: CachedMessage
): Promise<void> => {
  try {
    const key = getLastMessageKey(companyId, ticketId);
    await cache.set(key, JSON.stringify(message), "EX", MESSAGE_CACHE_TTL);
  } catch (err) {
    logger.debug(`[MessageCache] Erro ao cachear última mensagem: ${err}`);
  }
};

/**
 * Busca última mensagem de um ticket do cache
 */
export const getCachedLastMessage = async (
  companyId: number,
  ticketId: number
): Promise<CachedMessage | null> => {
  try {
    const key = getLastMessageKey(companyId, ticketId);
    const cached = await cache.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    logger.debug(`[MessageCache] Erro ao buscar última mensagem: ${err}`);
  }
  return null;
};

/**
 * Remove uma mensagem específica do cache
 */
export const removeCachedMessage = async (
  companyId: number,
  messageId: number
): Promise<void> => {
  try {
    const key = getMessageKey(companyId, messageId);
    await cache.del(key);
  } catch (err) {
    logger.debug(`[MessageCache] Erro ao remover mensagem do cache: ${err}`);
  }
};

export default {
  cacheMessage,
  getCachedMessage,
  cacheTicketMessages,
  getCachedTicketMessages,
  invalidateTicketMessagesCache,
  cacheLastMessage,
  getCachedLastMessage,
  removeCachedMessage
};
