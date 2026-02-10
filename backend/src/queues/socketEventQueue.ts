import Bull from "bull";
import logger from "../utils/logger";
import { emitToCompanyRoom } from "../libs/socketEmit";

// Fila de eventos Socket.IO com persistência no Redis
// Garante que eventos não sejam perdidos mesmo em caso de falhas
const REDIS_URI = process.env.REDIS_URI || process.env.REDIS_URI_MSG_CONN || "redis://127.0.0.1:6379";

// BUG-21 fix: Contador atômico para garantir unicidade do jobId
let jobCounter = 0;

interface SocketEventPayload {
  companyId: number;
  room: string;
  event: string;
  payload: any;
  priority?: number;
}

// Configuração da fila
const socketEventQueue = new Bull<SocketEventPayload>("socket-events", REDIS_URI, {
  defaultJobOptions: {
    attempts: 5, // Até 5 tentativas
    backoff: {
      type: "exponential",
      delay: 1000 // Começa com 1s, depois 2s, 4s, 8s, 16s
    },
    removeOnComplete: 100, // Mantém últimos 100 jobs completos para debug
    removeOnFail: 500 // Mantém últimos 500 jobs falhos para análise
  }
});

// Processador da fila
socketEventQueue.process(async (job) => {
  const { companyId, room, event, payload } = job.data;
  
  try {
    await emitToCompanyRoom(companyId, room, event, payload);
    logger.debug(`[SocketEventQueue] Evento ${event} emitido para sala ${room} (job ${job.id})`);
    return { success: true, room, event };
  } catch (error) {
    logger.error(`[SocketEventQueue] Erro ao emitir evento ${event} para sala ${room}:`, error);
    throw error; // Propaga erro para trigger retry
  }
});

// Event listeners para monitoramento
socketEventQueue.on("completed", (job, result) => {
  if (process.env.SOCKET_DEBUG === "true") {
    logger.debug(`[SocketEventQueue] Job ${job.id} completado:`, result);
  }
});

socketEventQueue.on("failed", (job, err) => {
  logger.warn(`[SocketEventQueue] Job ${job.id} falhou após ${job.attemptsMade} tentativas:`, err.message);
});

socketEventQueue.on("stalled", (job) => {
  logger.warn(`[SocketEventQueue] Job ${job.id} travado - será reprocessado`);
});

// Função para adicionar evento à fila
export async function queueSocketEvent(
  companyId: number,
  room: string,
  event: string,
  payload: any,
  priority: number = 1
): Promise<Bull.Job<SocketEventPayload>> {
  const job = await socketEventQueue.add(
    { companyId, room, event, payload },
    { 
      priority,
      // BUG-21 fix: Job ID único com contador atômico para evitar colisão no mesmo ms
      jobId: `${companyId}-${room}-${event}-${Date.now()}-${++jobCounter}`
    }
  );
  
  if (process.env.SOCKET_DEBUG === "true") {
    logger.debug(`[SocketEventQueue] Evento ${event} enfileirado para sala ${room} (job ${job.id})`);
  }
  
  return job;
}

// Função para emitir diretamente OU via fila (baseado em config)
export async function emitSocketEvent(
  companyId: number,
  room: string,
  event: string,
  payload: any,
  useQueue: boolean = false
): Promise<void> {
  if (useQueue || process.env.SOCKET_USE_QUEUE === "true") {
    await queueSocketEvent(companyId, room, event, payload);
  } else {
    await emitToCompanyRoom(companyId, room, event, payload);
  }
}

// Estatísticas da fila
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    socketEventQueue.getWaitingCount(),
    socketEventQueue.getActiveCount(),
    socketEventQueue.getCompletedCount(),
    socketEventQueue.getFailedCount(),
    socketEventQueue.getDelayedCount()
  ]);
  
  return { waiting, active, completed, failed, delayed };
}

// Limpar jobs antigos
export async function cleanOldJobs(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<void> {
  await socketEventQueue.clean(olderThanMs, "completed");
  await socketEventQueue.clean(olderThanMs * 7, "failed"); // Mantém falhos por 7 dias
  logger.info("[SocketEventQueue] Jobs antigos limpos");
}

export default socketEventQueue;
