/**
 * HELPER DE LOGS DETALHADOS PARA DEBUG
 * Adiciona logs contextuais sem afetar a lógica existente
 */
import logger from "../../utils/logger";

// Feature flag para habilitar logs detalhados
const ENABLE_DETAILED_LOGS = process.env.ENABLE_DETAILED_LOGS === "true";

/**
 * Log detalhado para mensagens recebidas
 */
export function logMessageReceived(data: any): void {
  if (!ENABLE_DETAILED_LOGS) return;
  
  const context = {
    id: data.key?.id,
    remoteJid: data.key?.remoteJid,
    fromMe: data.key?.fromMe,
    participant: data.participant,
    messageType: data.messageType,
    messageStubType: data.messageStubType,
    timestamp: data.messageTimestamp
  };
  
  logger.debug(`[MessageDebug] Mensagem recebida:`, JSON.stringify(context, null, 2));
}

/**
 * Log detalhado para mensagens CIPHERTEXT descartadas
 */
export function logCiphertextDiscarded(data: any, reason: string): void {
  if (!ENABLE_DETAILED_LOGS) return;
  
  const context = {
    id: data.key?.id,
    remoteJid: data.key?.remoteJid,
    participant: data.participant,
    reason,
    timestamp: Date.now()
  };
  
  logger.warn(`[CipherDebug] Mensagem CIPHERTEXT descartada:`, JSON.stringify(context, null, 2));
}

/**
 * Log detalhado para LID processing
 */
export function logLidProcessing(lid: string, action: string, result?: any): void {
  if (!ENABLE_DETAILED_LOGS) return;
  
  logger.debug(`[LidDebug] LID ${lid} - ${action}`, result ? JSON.stringify(result) : "");
}

/**
 * Log detalhado para criação/atualização de contato
 */
export function logContactOperation(contact: any, operation: 'create' | 'update', changes?: any): void {
  if (!ENABLE_DETAILED_LOGS) return;
  
  const context = {
    id: contact.id,
    name: contact.name,
    number: contact.number,
    remoteJid: contact.remoteJid,
    lidJid: contact.lidJid,
    operation,
    changes
  };
  
  logger.debug(`[ContactDebug] Contato ${operation}:`, JSON.stringify(context, null, 2));
}

/**
 * Log detalhado para operações de fila
 */
export function logQueueOperation(queueName: string, operation: string, data: any): void {
  if (!ENABLE_DETAILED_LOGS) return;
  
  logger.debug(`[QueueDebug] Fila ${queueName} - ${operation}:`, JSON.stringify({
    jobId: data.jobId,
    timestamp: Date.now(),
    ...data
  }, null, 2));
}

/**
 * Log detalhado para estado da conexão
 */
export function logConnectionState(sessionId: string, state: string, details?: any): void {
  if (!ENABLE_DETAILED_LOGS) return;
  
  logger.info(`[ConnectionDebug] Sessão ${sessionId} - Estado: ${state}`, details ? JSON.stringify(details) : "");
}

/**
 * Log de performance para operações críticas
 */
export function logPerformance(operation: string, startTime: number, details?: any): void {
  if (!ENABLE_DETAILED_LOGS) return;
  
  const duration = Date.now() - startTime;
  logger.debug(`[Performance] ${operation} levou ${duration}ms`, details ? JSON.stringify(details) : "");
}

/**
 * Wrapper para medir performance de funções
 */
export async function withPerformanceLog<T>(
  operation: string,
  fn: () => Promise<T>,
  details?: any
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await fn();
    logPerformance(operation, startTime, { ...details, success: true });
    return result;
  } catch (error) {
    logPerformance(operation, startTime, { ...details, success: false, error: error.message });
    throw error;
  }
}
