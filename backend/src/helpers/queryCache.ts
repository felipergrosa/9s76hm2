import Redis from "ioredis";
import logger from "../utils/logger";

/**
 * Cache Redis para queries frequentes
 * Reduz carga no PostgreSQL para consultas repetitivas
 */

// Singleton do cliente Redis
let redisClient: Redis | null = null;

const getRedisClient = (): Redis | null => {
    if (redisClient) return redisClient;

    const redisUrl = process.env.REDIS_URI || process.env.REDIS_URI_ACK;
    if (!redisUrl) {
        logger.warn("[QUERY CACHE] Redis não configurado. Cache desabilitado.");
        return null;
    }

    try {
        redisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            enableAutoPipelining: true,
            connectTimeout: 5000
        });

        redisClient.on("error", (err) => {
            logger.error("[QUERY CACHE] Redis error:", err.message);
        });

        redisClient.on("connect", () => {
            logger.info("[QUERY CACHE] Redis conectado");
        });

        return redisClient;
    } catch (err: any) {
        logger.error("[QUERY CACHE] Falha ao conectar Redis:", err.message);
        return null;
    }
};

// TTL padrão em segundos
const DEFAULT_TTL = parseInt(process.env.QUERY_CACHE_TTL || "30", 10);

// Prefixo para keys do cache
const CACHE_PREFIX = "qcache:";

/**
 * Executa query com cache
 * Se cache existir, retorna do cache
 * Se não, executa a função e armazena resultado
 * 
 * @param key - Chave única do cache
 * @param queryFn - Função async que retorna os dados
 * @param ttl - Tempo de vida em segundos (default: 30s)
 */
export async function cachedQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttl: number = DEFAULT_TTL
): Promise<T> {
    const redis = getRedisClient();
    const fullKey = `${CACHE_PREFIX}${key}`;

    // Se Redis não disponível, executa query diretamente
    if (!redis) {
        return queryFn();
    }

    try {
        // Tentar buscar do cache
        const cached = await redis.get(fullKey);
        if (cached) {
            if (process.env.CACHE_DEBUG === "true") {
                logger.debug(`[QUERY CACHE] HIT: ${key}`);
            }
            return JSON.parse(cached) as T;
        }

        // Cache miss - executar query
        if (process.env.CACHE_DEBUG === "true") {
            logger.debug(`[QUERY CACHE] MISS: ${key}`);
        }

        const result = await queryFn();

        // Armazenar no cache (em background)
        redis.setex(fullKey, ttl, JSON.stringify(result)).catch((err) => {
            logger.warn(`[QUERY CACHE] Falha ao salvar: ${err.message}`);
        });

        return result;
    } catch (err: any) {
        // Em caso de erro do Redis, fallback para query direta
        logger.warn(`[QUERY CACHE] Erro, fallback para query: ${err.message}`);
        return queryFn();
    }
}

/**
 * Invalida cache de uma key específica
 */
export async function invalidateCache(key: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;

    try {
        await redis.del(`${CACHE_PREFIX}${key}`);
        if (process.env.CACHE_DEBUG === "true") {
            logger.debug(`[QUERY CACHE] INVALIDATE: ${key}`);
        }
    } catch (err: any) {
        logger.warn(`[QUERY CACHE] Falha ao invalidar: ${err.message}`);
    }
}

/**
 * Invalida todas as keys que começam com um padrão
 * Útil para invalidar cache de uma empresa inteira
 */
export async function invalidateCachePattern(pattern: string): Promise<number> {
    const redis = getRedisClient();
    if (!redis) return 0;

    try {
        const keys = await redis.keys(`${CACHE_PREFIX}${pattern}*`);
        if (keys.length > 0) {
            await redis.del(...keys);
            if (process.env.CACHE_DEBUG === "true") {
                logger.debug(`[QUERY CACHE] INVALIDATE PATTERN: ${pattern} (${keys.length} keys)`);
            }
        }
        return keys.length;
    } catch (err: any) {
        logger.warn(`[QUERY CACHE] Falha ao invalidar padrão: ${err.message}`);
        return 0;
    }
}

/**
 * Gera chave de cache padronizada
 */
export function cacheKey(entity: string, companyId: number, ...args: (string | number)[]): string {
    return [entity, `c${companyId}`, ...args].join(":");
}

/**
 * Wrapper para cache de WhatsApps por empresa
 */
export async function getCachedWhatsapps(
    companyId: number,
    queryFn: () => Promise<any[]>
): Promise<any[]> {
    return cachedQuery(
        cacheKey("whatsapps", companyId),
        queryFn,
        60 // 1 minuto
    );
}

/**
 * Wrapper para cache de Filas por empresa
 */
export async function getCachedQueues(
    companyId: number,
    queryFn: () => Promise<any[]>
): Promise<any[]> {
    return cachedQuery(
        cacheKey("queues", companyId),
        queryFn,
        120 // 2 minutos
    );
}

/**
 * Wrapper para cache de Tags por empresa
 */
export async function getCachedTags(
    companyId: number,
    queryFn: () => Promise<any[]>
): Promise<any[]> {
    return cachedQuery(
        cacheKey("tags", companyId),
        queryFn,
        60 // 1 minuto
    );
}

/**
 * Wrapper para cache de Usuários por empresa
 */
export async function getCachedUsers(
    companyId: number,
    queryFn: () => Promise<any[]>
): Promise<any[]> {
    return cachedQuery(
        cacheKey("users", companyId),
        queryFn,
        60 // 1 minuto
    );
}

/**
 * Estatísticas de cache (para monitoramento)
 */
export async function getCacheStats(): Promise<{ connected: boolean; keyCount?: number }> {
    const redis = getRedisClient();
    if (!redis) {
        return { connected: false };
    }

    try {
        const keys = await redis.keys(`${CACHE_PREFIX}*`);
        return { connected: true, keyCount: keys.length };
    } catch {
        return { connected: false };
    }
}

export default {
    cachedQuery,
    invalidateCache,
    invalidateCachePattern,
    cacheKey,
    getCachedWhatsapps,
    getCachedQueues,
    getCachedTags,
    getCachedUsers,
    getCacheStats
};
