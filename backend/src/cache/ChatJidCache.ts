import NodeCache from "node-cache";
import logger from "../utils/logger";

interface CachedJidMapping {
  ticketId: number;
  contactId: number;
  discoveredJid: string;
  discoveredAt: number;
  source: "store_chats" | "remote_jid" | "fallback";
  confidence: "high" | "medium" | "low";
}

/**
 * Cache de mapeamentos ticket → JID descoberto
 * TTL: 6 horas (chats não mudam JID com frequência)
 * 
 * Benefícios:
 * - Evita descoberta repetida do mesmo chat
 * - Reduz carga no Baileys store
 * - Acelera importações subsequentes
 */
const jidCache = new NodeCache({ 
  stdTTL: 21600, // 6 horas
  checkperiod: 600, // Verificar expirados a cada 10min
  useClones: false
});

/**
 * Busca JID no cache por ticketId
 */
export const getCachedJid = (ticketId: number): string | null => {
  const cached = jidCache.get<CachedJidMapping>(`ticket:${ticketId}`);
  
  if (cached) {
    logger.debug(
      `[JidCache] HIT para ticket ${ticketId}: ${cached.discoveredJid} ` +
      `(source: ${cached.source}, confidence: ${cached.confidence})`
    );
    return cached.discoveredJid;
  }
  
  logger.debug(`[JidCache] MISS para ticket ${ticketId}`);
  return null;
};

/**
 * Armazena JID no cache
 */
export const setCachedJid = (
  ticketId: number,
  contactId: number,
  jid: string,
  source: "store_chats" | "remote_jid" | "fallback",
  confidence: "high" | "medium" | "low"
): void => {
  const mapping: CachedJidMapping = {
    ticketId,
    contactId,
    discoveredJid: jid,
    discoveredAt: Date.now(),
    source,
    confidence
  };
  
  jidCache.set(`ticket:${ticketId}`, mapping);
  
  logger.info(
    `[JidCache] Cached JID para ticket ${ticketId}: ${jid} ` +
    `(source: ${source}, confidence: ${confidence})`
  );
};

/**
 * Invalida cache de um ticket específico
 * Útil quando o contato muda de número ou há atualização manual
 */
export const invalidateCachedJid = (ticketId: number): void => {
  const deleted = jidCache.del(`ticket:${ticketId}`);
  
  if (deleted) {
    logger.info(`[JidCache] Cache invalidado para ticket ${ticketId}`);
  }
};

/**
 * Invalida cache de todos os tickets de um contato
 */
export const invalidateContactJids = async (contactId: number): Promise<number> => {
  const allKeys = jidCache.keys();
  let deletedCount = 0;
  
  for (const key of allKeys) {
    const cached = jidCache.get<CachedJidMapping>(key);
    if (cached && cached.contactId === contactId) {
      jidCache.del(key);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    logger.info(`[JidCache] ${deletedCount} entradas invalidadas para contactId ${contactId}`);
  }
  
  return deletedCount;
};

/**
 * Retorna estatísticas do cache
 */
export const getCacheStats = () => {
  const stats = jidCache.getStats();
  const keys = jidCache.keys();
  
  return {
    entries: keys.length,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: stats.hits / (stats.hits + stats.misses || 1),
    keys: stats.keys,
    ksize: stats.ksize,
    vsize: stats.vsize
  };
};

/**
 * Limpa todo o cache (usar apenas em casos extremos)
 */
export const clearAllJidCache = (): void => {
  const keysCount = jidCache.keys().length;
  jidCache.flushAll();
  logger.warn(`[JidCache] Cache completamente limpo (${keysCount} entradas removidas)`);
};

/**
 * Retorna todas as entradas do cache (para debug)
 */
export const getAllCachedMappings = (): CachedJidMapping[] => {
  const keys = jidCache.keys();
  const mappings: CachedJidMapping[] = [];
  
  for (const key of keys) {
    const cached = jidCache.get<CachedJidMapping>(key);
    if (cached) {
      mappings.push(cached);
    }
  }
  
  return mappings;
};
