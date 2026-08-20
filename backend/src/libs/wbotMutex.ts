import logger from "../utils/logger";
import cacheLayer from "./cache";

const LOCK_TTL_SECONDS = 180;
const sessionLockOwners = new Map<number | string, string>();

const getOwnerId = (): string => `${process.env.HOSTNAME || "instance"}:${process.pid}`;

/**
 * wbotMutex - lock distribuído por sessão com fallback local.
 *
 * O lock impede que duas instâncias controlem o mesmo WhatsApp
 * e mantém o write fencing do estado de autenticação funcional.
 */

export const getLockKey = (whatsappId: number | string) => `wbot:mutex:${whatsappId}`;

export const getCurrentInstanceId = (): string => {
    return process.env.HOSTNAME || `instance-${process.pid}`;
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
    const ownerId = getOwnerId();

    if (!redis) {
        logger.warn(`[WbotMutex] Redis indisponível; usando lock local para whatsappId=${whatsappId}${callerInfo}`);
        sessionLockOwners.set(whatsappId, ownerId);
        return true;
    }

    try {
        const result = await redis.set(getLockKey(whatsappId), ownerId, "NX", "EX", LOCK_TTL_SECONDS);
        if (result === "OK") {
            sessionLockOwners.set(whatsappId, ownerId);
            logger.debug(`[WbotMutex] Lock adquirido para whatsappId=${whatsappId}${callerInfo}`);
            return true;
        }

        const currentOwner = await redis.get(getLockKey(whatsappId));
        if (currentOwner === ownerId) {
            await redis.expire(getLockKey(whatsappId), LOCK_TTL_SECONDS);
            sessionLockOwners.set(whatsappId, ownerId);
            return true;
        }

        logger.warn(`[WbotMutex] Lock negado para whatsappId=${whatsappId}; sessão pertence a outra instância.`);
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
    if (!redis || !ownerId) return true;

    try {
        const currentOwner = await redis.get(getLockKey(whatsappId));
        if (currentOwner !== ownerId) return false;
        return (await redis.expire(getLockKey(whatsappId), LOCK_TTL_SECONDS)) === 1;
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
    if (!redis || !ownerId) return;

    try {
        const currentOwner = await redis.get(getLockKey(whatsappId));
        if (currentOwner === ownerId) {
            await redis.del(getLockKey(whatsappId));
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
    if (!redis || !ownerId) return true;

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
    if (!redis) return sessionLockOwners.get(whatsappId) || null;
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

