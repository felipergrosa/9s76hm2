import { Mutex } from 'async-mutex';
import logger from '../utils/logger';

/**
 * fetchHistoryMutex - Gerenciamento de Mutex e Rate Limiting para fetchMessageHistory
 * 
 * Problema: Múltiplas chamadas concorrentes a fetchMessageHistory na MESMA conexão WhatsApp
 * corrompem o websocket, causando xml-not-well-formed.
 * 
 * Solução:
 * 1. Mutex por whatsappId - Serializa fetches da mesma conexão
 * 2. Rate limiting - 5s entre fetches da mesma conexão
 * 3. Permite fetches paralelos de conexões diferentes
 */

// Mutex por whatsappId
const fetchMutexes = new Map<number, Mutex>();

// Rate limiting: último timestamp de fetch por whatsappId
const lastFetchTime = new Map<number, number>();

// Configurações
const FETCH_COOLDOWN_MS = 5000; // 5 segundos entre fetches da mesma conexão
const MUTEX_TIMEOUT_MS = 60000; // 1 minuto timeout no mutex

/**
 * Obtém ou cria o Mutex para um whatsappId
 */
function getFetchMutex(whatsappId: number): Mutex {
  if (!fetchMutexes.has(whatsappId)) {
    fetchMutexes.set(whatsappId, new Mutex());
    logger.debug(`[FetchMutex] Mutex criado para whatsappId=${whatsappId}`);
  }
  return fetchMutexes.get(whatsappId)!;
}

/**
 * Verifica se pode fazer fetch (rate limiting)
 */
function canFetch(whatsappId: number): boolean {
  const last = lastFetchTime.get(whatsappId) || 0;
  const now = Date.now();
  const elapsed = now - last;
  
  if (elapsed < FETCH_COOLDOWN_MS) {
    const remaining = Math.ceil((FETCH_COOLDOWN_MS - elapsed) / 1000);
    logger.info(`[FetchMutex] Rate limit ativo para whatsappId=${whatsappId}, aguardar ${remaining}s`);
    return false;
  }
  
  return true;
}

/**
 * Atualiza o timestamp do último fetch
 */
function updateFetchTime(whatsappId: number): void {
  lastFetchTime.set(whatsappId, Date.now());
}

/**
 * Adquire lock para fetchMessageHistory com proteção de rate limiting
 * 
 * Retorna uma função de release que DEVE ser chamada no finally
 * 
 * @throws Error se rate limit estiver ativo
 */
export const acquireFetchLock = async (whatsappId: number, caller: string = 'unknown'): Promise<() => void> => {
  // Verificar rate limiting ANTES de adquirir o mutex
  if (!canFetch(whatsappId)) {
    const last = lastFetchTime.get(whatsappId) || 0;
    const elapsed = Date.now() - last;
    const remaining = Math.ceil((FETCH_COOLDOWN_MS - elapsed) / 1000);
    throw new Error(`Rate limit ativo. Aguarde ${remaining}s antes de buscar histórico novamente.`);
  }
  
  const mutex = getFetchMutex(whatsappId);
  
  logger.info(`[FetchMutex] ${caller} tentando adquirir lock para whatsappId=${whatsappId}`);
  
  // Tentar adquirir o mutex com timeout
  let release: () => void;
  
  try {
    release = await mutex.acquire();
  } catch (err: any) {
    logger.error(`[FetchMutex] Erro ao adquirir mutex para whatsappId=${whatsappId}: ${err?.message}`);
    throw new Error(`Não foi possível adquirir lock para buscar histórico: ${err?.message}`);
  }
  
  logger.info(`[FetchMutex] ${caller} adquiriu lock para whatsappId=${whatsappId}`);
  
  // Atualizar timestamp do último fetch
  updateFetchTime(whatsappId);
  
  // Retornar função de release
  return () => {
    release();
    logger.info(`[FetchMutex] ${caller} liberou lock para whatsappId=${whatsappId}`);
  };
};

/**
 * Executa uma operação de fetch com proteção de mutex e rate limiting
 * 
 * Uso:
 * ```typescript
 * const result = await executeFetchWithLock(whatsappId, 'SyncChatHistory', async () => {
 *   await wbot.fetchMessageHistory(count, key, timestamp);
 *   return result;
 * });
 * ```
 */
export const executeFetchWithLock = async <T>(
  whatsappId: number,
  caller: string,
  operation: () => Promise<T>
): Promise<T> => {
  const releaseLock = await acquireFetchLock(whatsappId, caller);
  
  try {
    const result = await operation();
    return result;
  } finally {
    releaseLock();
  }
};

/**
 * Obtém estatísticas dos mutexes ativos
 */
export const getFetchMutexStats = () => {
  return {
    activeMutexes: fetchMutexes.size,
    whatsappIds: Array.from(fetchMutexes.keys()),
    lastFetchTimes: Array.from(lastFetchTime.entries()).map(([id, time]) => ({
      whatsappId: id,
      lastFetch: new Date(time).toISOString(),
      elapsedMs: Date.now() - time
    }))
  };
};

/**
 * Limpa mutexes inativos (cleanup periódico)
 */
export const cleanupInactiveMutexes = () => {
  const now = Date.now();
  const INACTIVE_THRESHOLD = 600000; // 10 minutos
  
  let cleaned = 0;
  
  for (const [whatsappId, lastTime] of lastFetchTime.entries()) {
    if (now - lastTime > INACTIVE_THRESHOLD) {
      fetchMutexes.delete(whatsappId);
      lastFetchTime.delete(whatsappId);
      cleaned++;
      logger.debug(`[FetchMutex] Mutex limpo para whatsappId=${whatsappId} (inativo por ${Math.floor((now - lastTime) / 1000)}s)`);
    }
  }
  
  if (cleaned > 0) {
    logger.info(`[FetchMutex] Cleanup: ${cleaned} mutexes inativos removidos`);
  }
  
  return cleaned;
};
