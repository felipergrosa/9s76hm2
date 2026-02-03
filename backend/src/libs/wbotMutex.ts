import logger from "../utils/logger";
import cacheLayer from "./cache";
import * as crypto from "crypto";

const LOCK_TTL_SECONDS = 180; // 3 minutos para suportar delays de reconexão (até 120s)
const LOCK_RENEW_INTERVAL_MS = 20000;

// Mapa de tokens de sessão: cada chamada a acquireWbotLock gerará um UUID único.
// Isso garante que sessões antigas (zumbis) no mesmo processo não possam liberar locks
// que pertencem a sessões mais novas.
const sessionLockTokens = new Map<number | string, string>();

export const getLockKey = (whatsappId: number | string) => `wbot:mutex:${whatsappId}`;

export const getCurrentInstanceId = (): string => {
    return process.env.HOSTNAME || `instance-${process.pid}`;
};

/**
 * Retorna o token de lock atual para uma sessão. Útil para verificação.
 */
export const getSessionLockToken = (whatsappId: number | string): string | undefined => {
    return sessionLockTokens.get(whatsappId);
};

/**
 * Tenta adquirir o lock para controlar a sessão do WhatsApp.
 * Suporta reentrância: se já sou o dono, renova e retorna true.
 * Gera um novo token de sessão (UUID) para identificar esta aquisição.
 */
export const acquireWbotLock = async (whatsappId: number | string): Promise<boolean> => {
    const key = getLockKey(whatsappId);
    const redis = cacheLayer.getRedisInstance();

    if (!redis) {
        logger.warn(`[WbotMutex] Redis indisponível, assumindo lock local para ${whatsappId}`);
        return true;
    }

    // Gera um novo token único para esta sessão
    const sessionToken = crypto.randomUUID();
    const baseId = getCurrentInstanceId();
    const ownerId = `${baseId}:${sessionToken}`;

    try {
        // Lua script para atomicidade e reentrância.
        // NOTA: Reentrância agora compara APENAS o prefixo (HOSTNAME).
        // Se o prefixo bater, ATUALIZA o valor para o novo token e renova o TTL.
        // Isso garante que novas sessões do mesmo processo "assumam" o controle.
        const script = `
            local current = redis.call("get", KEYS[1])
            if current == nil or current == false then
                -- Ninguém tem o lock, adquirir
                redis.call("set", KEYS[1], ARGV[1], "EX", ARGV[2])
                return 1
            else
                -- Alguém tem o lock. Verificar se é do mesmo host (prefixo antes de ':')
                local currentHost = string.match(current, "^([^:]+)")
                local myHost = string.match(ARGV[1], "^([^:]+)")
                if currentHost == myHost then
                    -- Mesmo host, assumir controle com novo token
                    redis.call("set", KEYS[1], ARGV[1], "EX", ARGV[2])
                    return 1
                else
                    -- Outro host é o dono
                    return 0
                end
            end
        `;

        const result = await redis.eval(script, 1, key, ownerId, LOCK_TTL_SECONDS);

        if (result === 1) {
            // Salvar o token para esta sessão
            sessionLockTokens.set(whatsappId, ownerId);
            logger.info(`[WbotMutex] Lock adquirido/renovado para whatsappId=${whatsappId} (owner=${baseId})`);
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
 * USA o token exato que foi gerado em acquireWbotLock.
 */
export const renewWbotLock = async (whatsappId: number | string): Promise<boolean> => {
    const key = getLockKey(whatsappId);
    const redis = cacheLayer.getRedisInstance();
    if (!redis) return true;

    const ownerId = sessionLockTokens.get(whatsappId);
    if (!ownerId) {
        logger.warn(`[WbotMutex] Nenhum token de sessão encontrado para ${whatsappId}. Não é possível renovar.`);
        return false;
    }

    try {
        // Script Lua para garantir que só renova se for o dono EXATO (token completo)
        const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

        const result = await redis.eval(script, 1, key, ownerId, LOCK_TTL_SECONDS);

        if (result === 1) {
            // logger.debug(`[WbotMutex] Lock renovado para whatsappId=${whatsappId}`)
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
 * USA o token exato que foi gerado em acquireWbotLock.
 * Se o token não bate (sessão antiga/zumbi), NÃO libera.
 */
export const releaseWbotLock = async (whatsappId: number | string): Promise<void> => {
    const key = getLockKey(whatsappId);
    const redis = cacheLayer.getRedisInstance();
    if (!redis) return;

    const ownerId = sessionLockTokens.get(whatsappId);
    if (!ownerId) {
        logger.debug(`[WbotMutex] Nenhum token de sessão para ${whatsappId}. Ignorando release (provavelmente sessão antiga).`);
        return;
    }

    try {
        // Só deleta se for o dono EXATO (token completo)
        const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
        const result = await redis.eval(script, 1, key, ownerId);
        if (result === 1) {
            sessionLockTokens.delete(whatsappId);
            logger.info(`[WbotMutex] Lock liberado para whatsappId=${whatsappId}`);
        } else {
            logger.debug(`[WbotMutex] Lock NÃO liberado para ${whatsappId} (token não bateu - outra sessão é dona).`);
        }
    } catch (err) {
        logger.error(`[WbotMutex] Erro ao liberar lock: ${err}`);
    }
};

/**
 * Verifica se esta instância ainda é a dona do lock.
 * Útil para "Write Fencing" (impedir escritas de zumbis).
 * USA o token exato que foi gerado em acquireWbotLock.
 */
export const checkWbotLock = async (whatsappId: number | string): Promise<boolean> => {
    const key = getLockKey(whatsappId);
    const redis = cacheLayer.getRedisInstance();
    if (!redis) return true;

    const ownerId = sessionLockTokens.get(whatsappId);
    if (!ownerId) {
        // Se não temos token, provavelmente esta sessão não adquiriu o lock
        return false;
    }

    try {
        const currentOwner = await redis.get(key);
        // Só retorna true se o token no Redis bate EXATAMENTE
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

