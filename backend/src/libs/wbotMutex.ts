import logger from "../utils/logger";
import cacheLayer from "./cache";

const LOCK_TTL_SECONDS = 60;
const LOCK_RENEW_INTERVAL_MS = 20000;

export const getLockKey = (whatsappId: number | string) => `wbot:mutex:${whatsappId}`;

export const getCurrentInstanceId = (): string => {
    return process.env.HOSTNAME || `instance-${process.pid}`;
};

/**
 * Tenta adquirir o lock para controlar a sessão do WhatsApp.
 * Retorna true se conseguiu o lock (é o líder), false se já existe outro dono.
 */
/**
 * Tenta adquirir o lock para controlar a sessão do WhatsApp.
 * Suporta reentrância: se já sou o dono, renova e retorna true.
 */
export const acquireWbotLock = async (whatsappId: number | string): Promise<boolean> => {
    const key = getLockKey(whatsappId);
    const redis = cacheLayer.getRedisInstance();

    if (!redis) {
        logger.warn(`[WbotMutex] Redis indisponível, assumindo lock local para ${whatsappId}`);
        return true;
    }

    const ownerId = getCurrentInstanceId();

    try {
        // Lua script para atomicidade e reentrância
        // 1. Se não existe: SET e retorna 1
        // 2. Se existe e é meu: RENOVA (expire) e retorna 1
        // 3. Se existe e não é meu: retorna 0
        const script = `
            if redis.call("exists", KEYS[1]) == 0 then
                redis.call("set", KEYS[1], ARGV[1], "EX", ARGV[2])
                return 1
            elseif redis.call("get", KEYS[1]) == ARGV[1] then
                redis.call("expire", KEYS[1], ARGV[2])
                return 1
            else
                return 0
            end
        `;

        const result = await redis.eval(script, 1, key, ownerId, LOCK_TTL_SECONDS);

        if (result === 1) {
            logger.info(`[WbotMutex] Lock adquirido/renovado para whatsappId=${whatsappId} (owner=${ownerId})`);
            return true;
        } else {
            const currentOwner = await redis.get(key);
            logger.debug(`[WbotMutex] Lock NEGADO para whatsappId=${whatsappId}. Dono atual: ${currentOwner}`);
            return false;
        }
    } catch (err) {
        logger.error(`[WbotMutex] Erro ao adquirir lock: ${err}`);
        return false;
    }
};

/**
 * Renova o lock para manter a sessão ativa.
 * Deve ser chamado periodicamente pelo dono do lock.
 */
export const renewWbotLock = async (whatsappId: number | string): Promise<boolean> => {
    const key = getLockKey(whatsappId);
    const redis = cacheLayer.getRedisInstance();
    if (!redis) return true;

    const ownerId = process.env.HOSTNAME || `instance-${process.pid}`;

    try {
        // Script Lua para garantir que só renova se for o dono
        // Se o valor for ownerId, atualiza EXPIRE. Senão, retorna 0.
        const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

        const result = await redis.eval(script, 1, key, ownerId, LOCK_TTL_SECONDS);

        if (result === 1) {
            // logger.debug(`[WbotMutex] Lock renovado para whatsappId=${whatsappId}`);
            return true;
        } else {
            logger.warn(`[WbotMutex] Falha ao renovar lock para ${whatsappId}. Talvez tenha expirado ou mudado de dono.`);
            return false;
        }
    } catch (err) {
        logger.error(`[WbotMutex] Erro ao renovar lock: ${err}`);
        return false;
    }
};

/**
 * Libera o lock explicitamente (no shutdown ou disconnect).
 */
export const releaseWbotLock = async (whatsappId: number | string): Promise<void> => {
    const key = getLockKey(whatsappId);
    const redis = cacheLayer.getRedisInstance();
    if (!redis) return;

    const ownerId = process.env.HOSTNAME || `instance-${process.pid}`;

    try {
        // Só deleta se for o dono
        const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
        await redis.eval(script, 1, key, ownerId);
        logger.info(`[WbotMutex] Lock liberado para whatsappId=${whatsappId}`);
    } catch (err) {
        logger.error(`[WbotMutex] Erro ao liberar lock: ${err}`);
    }
};

/**
 * Verifica se esta instância ainda é a dona do lock.
 * Útil para "Write Fencing" (impedir escritas de zumbis).
 */
export const checkWbotLock = async (whatsappId: number | string): Promise<boolean> => {
    const key = getLockKey(whatsappId);
    const redis = cacheLayer.getRedisInstance();
    if (!redis) return true;

    const ownerId = process.env.HOSTNAME || `instance-${process.pid}`;

    try {
        const currentOwner = await redis.get(key);
        // Se não tem dono, ou o dono é outro, retorna false
        return currentOwner === ownerId;
    } catch (err) {
        logger.error(`[WbotMutex] Erro ao checar lock: ${err}`);
        // Em caso de erro no Redis, por segurança, assumimos false para evitar corrupção
        return false;
    }
};

/**
 * Retorna o dono atual do lock (se houver).
 */
export const getWbotLockOwner = async (whatsappId: number | string): Promise<string | null> => {
    const key = getLockKey(whatsappId);
    const redis = cacheLayer.getRedisInstance();
    if (!redis) return null;

    try {
        return await redis.get(key);
    } catch (err) {
        logger.error(`[WbotMutex] Erro ao obter lock owner: ${err}`);
        return null;
    }
};

/**
 * Limpa todos os locks de sessão do WhatsApp.
 * DEVE ser usado apenas no startup do servidor em deployments SINGLE INSTANCE.
 */
export const clearSessionLocks = async (): Promise<void> => {
    const pattern = "wbot:mutex:*";
    try {
        await cacheLayer.delFromPattern(pattern);
        logger.info(`[WbotMutex] Todos os locks de sessão ('${pattern}') foram removidos.`);
    } catch (err) {
        logger.error(`[WbotMutex] Erro ao limpar locks de sessão: ${err}`);
    }
};

