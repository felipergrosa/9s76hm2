import logger from "../utils/logger";
import cacheLayer from "./cache";
import { randomUUID } from "crypto";

const LOCK_TTL_SECONDS = 180;
const sessionLockOwners = new Map<number | string, string>();
const INSTANCE_OWNER_ID = `${process.env.HOSTNAME || "instance"}:${process.pid}:${randomUUID()}`;
const hasDistributedRedis = (): boolean => Boolean(process.env.REDIS_URI);

/**
 * wbotMutex - lock distribuído por sessão com fallback local.
 *
 * O lock impede que duas instâncias controlem o mesmo WhatsApp
 * e mantém o write fencing do estado de autenticação funcional.
 */

export const getLockKey = (whatsappId: number | string) => `wbot:mutex:${whatsappId}`;

export const getCurrentInstanceId = (): string => {
    return INSTANCE_OWNER_ID;
};

/**
 * Retorna o token de lock atual para uma sessão.
 */
export const getSessionLockToken = (whatsappId: number | string): string | undefined => {
    return sessionLockOwners.get(whatsappId);
};

/**
 * Tenta adquirir o lock para controlar a sessão do WhatsApp.
 * Retorna false quando outra instância possui o lock.
 */
export const acquireWbotLock = async (whatsappId: number | string, caller?: string): Promise<boolean> => {
    const callerInfo = caller ? ` (caller=${caller})` : "";
    const redis = cacheLayer.getRedisInstance();
    const ownerId = INSTANCE_OWNER_ID;

    if (!hasDistributedRedis()) {
        logger.warn(`[WbotMutex] REDIS_URI não configurado; lock apenas local para whatsappId=${whatsappId}${callerInfo}`);
        sessionLockOwners.set(whatsappId, ownerId);
        return true;
    }

    try {
        // Aquisição/reentrada atômica: somente o mesmo token pode renovar o lock.
        const script = `
          local current = redis.call("get", KEYS[1])
          if not current or current == ARGV[1] then
            redis.call("set", KEYS[1], ARGV[1], "EX", ARGV[2])
            return 1
          end
          return 0
        `;
        const result = await redis.eval(
            script,
            1,
            getLockKey(whatsappId),
            ownerId,
            LOCK_TTL_SECONDS
        );

        if (result === 1) {
            sessionLockOwners.set(whatsappId, ownerId);
            logger.debug(`[WbotMutex] Lock adquirido para whatsappId=${whatsappId}${callerInfo}`);
            return true;
        }

        const currentOwner = await redis.get(getLockKey(whatsappId));
        logger.warn(`[WbotMutex] Lock negado para whatsappId=${whatsappId}; owner=${currentOwner || "desconhecido"}.`);
        return false;
    } catch (error: any) {
        logger.error(`[WbotMutex] Erro ao adquirir lock para whatsappId=${whatsappId}: ${error?.message}`);
        return false;
    }
};

/**
 * Renova o lock para manter a sessão ativa.
 * Retorna false quando outra instância possui o lock.
 */
export const renewWbotLock = async (whatsappId: number | string): Promise<boolean> => {
    const redis = cacheLayer.getRedisInstance();
    const ownerId = sessionLockOwners.get(whatsappId);
    if (!hasDistributedRedis()) return Boolean(ownerId);
    if (!ownerId) return false;

    try {
        const script = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("expire", KEYS[1], ARGV[2])
          end
          return 0
        `;
        return (await redis.eval(
            script,
            1,
            getLockKey(whatsappId),
            ownerId,
            LOCK_TTL_SECONDS
        )) === 1;
    } catch (error: any) {
        logger.error(`[WbotMutex] Erro ao renovar lock para whatsappId=${whatsappId}: ${error?.message}`);
        return false;
    }
};

/**
 * Libera o lock explicitamente (no shutdown ou disconnect).
 * Libera somente o lock pertencente a esta instância.
 */
export const releaseWbotLock = async (whatsappId: number | string): Promise<void> => {
    const redis = cacheLayer.getRedisInstance();
    const ownerId = sessionLockOwners.get(whatsappId);
    sessionLockOwners.delete(whatsappId);
    if (!hasDistributedRedis() || !ownerId) return;

    try {
        const script = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          end
          return 0
        `;
        const released = await redis.eval(script, 1, getLockKey(whatsappId), ownerId);
        if (released === 1) {
            logger.debug(`[WbotMutex] Lock liberado para whatsappId=${whatsappId}`);
        }
    } catch (error: any) {
        logger.error(`[WbotMutex] Erro ao liberar lock para whatsappId=${whatsappId}: ${error?.message}`);
    }
};

/**
 * Verifica se esta instância ainda é a dona do lock.
 * Retorna false quando outra instância possui o lock.
 */
export const checkWbotLock = async (whatsappId: number | string): Promise<boolean> => {
    const redis = cacheLayer.getRedisInstance();
    const ownerId = sessionLockOwners.get(whatsappId);
    if (!hasDistributedRedis()) return Boolean(ownerId);
    if (!ownerId) return false;

    try {
        return (await redis.get(getLockKey(whatsappId))) === ownerId;
    } catch (error: any) {
        logger.error(`[WbotMutex] Erro ao verificar lock para whatsappId=${whatsappId}: ${error?.message}`);
        return false;
    }
};

/**
 * Retorna o dono atual do lock (se houver).
 */
export const getWbotLockOwner = async (whatsappId: number | string): Promise<string | null> => {
    const redis = cacheLayer.getRedisInstance();
    if (!hasDistributedRedis()) return sessionLockOwners.get(whatsappId) || null;
    return redis.get(getLockKey(whatsappId));
};

/**
 * Limpa todos os locks de sessão do WhatsApp.
 * Libera somente o lock pertencente a esta instância.
 */
export const clearSessionLocks = async (): Promise<void> => {
    sessionLockOwners.clear();
    logger.info(`[WbotMutex] Estado local de locks limpo no startup; locks remotos expiram por TTL.`);
};

