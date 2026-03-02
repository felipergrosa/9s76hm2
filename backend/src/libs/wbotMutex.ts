import logger from "../utils/logger";

/**
 * wbotMutex - VERSÃO SIMPLIFICADA PARA AMBIENTE SINGLE-INSTANCE
 * 
 * Em ambiente de única instância, não é necessário Redis lock.
 * A flag `reconnectingWhatsapps` em wbot.ts já previne reconexões duplicadas.
 * 
 * Se você precisar de multi-instância no futuro, restaure a versão anterior
 * com Redis lock para Leader Election.
 */

export const getLockKey = (whatsappId: number | string) => `wbot:mutex:${whatsappId}`;

export const getCurrentInstanceId = (): string => {
    return process.env.HOSTNAME || `instance-${process.pid}`;
};

/**
 * Retorna o token de lock atual para uma sessão.
 */
export const getSessionLockToken = (whatsappId: number | string): string | undefined => {
    return undefined;
};

/**
 * Tenta adquirir o lock para controlar a sessão do WhatsApp.
 * VERSÃO SIMPLIFICADA: Sempre retorna true em ambiente single-instance.
 */
export const acquireWbotLock = async (whatsappId: number | string, caller?: string): Promise<boolean> => {
    const callerInfo = caller ? ` (caller=${caller})` : "";
    logger.debug(`[WbotMutex] Lock adquirido (single-instance) para whatsappId=${whatsappId}${callerInfo}`);
    return true;
};

/**
 * Renova o lock para manter a sessão ativa.
 * VERSÃO SIMPLIFICADA: Sempre retorna true em ambiente single-instance.
 */
export const renewWbotLock = async (whatsappId: number | string): Promise<boolean> => {
    return true;
};

/**
 * Libera o lock explicitamente (no shutdown ou disconnect).
 * VERSÃO SIMPLIFICADA: No-op em ambiente single-instance.
 */
export const releaseWbotLock = async (whatsappId: number | string): Promise<void> => {
    logger.debug(`[WbotMutex] Lock liberado (single-instance) para whatsappId=${whatsappId}`);
};

/**
 * Verifica se esta instância ainda é a dona do lock.
 * VERSÃO SIMPLIFICADA: Sempre retorna true em ambiente single-instance.
 */
export const checkWbotLock = async (whatsappId: number | string): Promise<boolean> => {
    return true;
};

/**
 * Retorna o dono atual do lock (se houver).
 * VERSÃO SIMPLIFICADA: Sempre retorna a instância atual em ambiente single-instance.
 */
export const getWbotLockOwner = async (whatsappId: number | string): Promise<string | null> => {
    return getCurrentInstanceId();
};

/**
 * Limpa todos os locks de sessão do WhatsApp.
 * VERSÃO SIMPLIFICADA: No-op em ambiente single-instance.
 */
export const clearSessionLocks = async (): Promise<void> => {
    logger.info(`[WbotMutex] clearSessionLocks (single-instance) - no-op`);
};

