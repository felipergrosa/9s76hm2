/**
 * WAIT FOR SESSION READY - Controle de Sessão Pronta
 * Implementação segura com feature flag para não afetar código existente
 */
import logger from "../../utils/logger";

// Feature flag para habilitar/desabilitar o controle
const ENABLE_SESSION_READY_CONTROL = process.env.ENABLE_SESSION_READY_CONTROL === "true";

// Map de waiters por sessão
const sessionWaiters = new Map<string, {
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}>();

// Map de estado das sessões
const sessionStates = new Map<string, boolean>();

/**
 * Marca sessão como pronta e resolve todos os waiters
 */
export function markSessionReady(sessionId: string, ready: boolean = true): void {
  if (!ENABLE_SESSION_READY_CONTROL) return;
  
  sessionStates.set(sessionId, ready);
  
  if (ready) {
    logger.info(`[SessionReady] Sessão ${sessionId} marcada como PRONTA`);
    
    // Resolve todos os waiters
    const waiters = sessionWaiters.get(sessionId);
    if (waiters) {
      const allWaiters = Array.isArray(waiters) ? waiters : [waiters];
      allWaiters.forEach(waiter => {
        clearTimeout(waiter.timeout);
        waiter.resolve();
      });
      sessionWaiters.delete(sessionId);
    }
  } else {
    logger.info(`[SessionReady] Sessão ${sessionId} marcada como NÃO PRONTA`);
  }
}

/**
 * Aguarda até que a sessão esteja pronta
 * @param sessionId ID da sessão WhatsApp
 * @param timeout Timeout em ms (padrão: 30s)
 */
export async function waitForSessionReady(
  sessionId: string, 
  timeout: number = 30000
): Promise<void> {
  // Se feature flag desabilitado, retorna imediatamente
  if (!ENABLE_SESSION_READY_CONTROL) {
    return;
  }
  
  // Se já está pronta, retorna
  if (sessionStates.get(sessionId)) {
    return;
  }
  
  logger.debug(`[SessionReady] Aguardando sessão ${sessionId} ficar pronta...`);
  
  return new Promise((resolve, reject) => {
    // Configura timeout
    const timeoutId = setTimeout(() => {
      sessionWaiters.delete(sessionId);
      reject(new Error(`Timeout aguardando sessão ${sessionId} ficar pronta (${timeout}ms)`));
    }, timeout);
    
    // Adiciona aos waiters
    const waiters = sessionWaiters.get(sessionId) || [];
    waiters.push({
      resolve,
      reject,
      timeout: timeoutId
    });
    sessionWaiters.set(sessionId, waiters);
  });
}

/**
 * Verifica se sessão existe e está pronta
 */
export function isSessionReady(sessionId: string): boolean {
  if (!ENABLE_SESSION_READY_CONTROL) {
    return true; // Se desabilitado, assume que está sempre pronto
  }
  
  return sessionStates.get(sessionId) || false;
}

/**
 * Limpa waiters de uma sessão (chamado ao desconectar)
 */
export function clearSessionWaiters(sessionId: string): void {
  if (!ENABLE_SESSION_READY_CONTROL) return;
  
  const waiters = sessionWaiters.get(sessionId);
  if (waiters) {
    const allWaiters = Array.isArray(waiters) ? waiters : [waiters];
    allWaiters.forEach(waiter => {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error(`Sessão ${sessionId} desconectada`));
    });
    sessionWaiters.delete(sessionId);
  }
  
  sessionStates.delete(sessionId);
  logger.info(`[SessionReady] Waiters da sessão ${sessionId} limpos`);
}

/**
 * Wrapper para usar em funções que precisam esperar sessão pronta
 */
export async function withSessionReady<T>(
  sessionId: string,
  operation: () => Promise<T>,
  timeout?: number
): Promise<T> {
  await waitForSessionReady(sessionId, timeout);
  return operation();
}
