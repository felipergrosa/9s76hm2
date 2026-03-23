import Queue from "bull";
import ImportContactHistoryService from "./ImportContactHistoryService";
import logger from "../../utils/logger";

// Configuração Redis (inline para evitar problema de import)
const redisConfig = {
  host: process.env.IO_REDIS_SERVER || "127.0.0.1",
  port: Number(process.env.IO_REDIS_PORT) || 6379,
  password: process.env.IO_REDIS_PASSWORD || undefined,
  db: Number(process.env.IO_REDIS_DB_SESSION) || 3
};

interface ImportHistoryJob {
  ticketId: number;
  companyId: number;
  periodMonths: number;
  downloadMedia?: boolean;
  requestedBy: "lazy_open" | "manual_resync" | "manual_import" | "auto_sync" | "sync_full_history";
  deferredCount?: number;
}

const MAX_DEFERRED_ATTEMPTS = 6;
const DEFER_DELAY_MS = 15000;

const shouldDeferImport = (result: any): boolean => {
  const reason = String(result?.reason || "");
  return ["SESSION_RECONNECTING", "SESSION_NOT_READY", "SESSION_UNSTABLE"].includes(reason);
};

/**
 * Queue assíncrona para importação de histórico de mensagens
 * 
 * Benefícios:
 * - Não bloqueia requisições HTTP
 * - Retry automático em caso de falha
 * - Isolamento de falhas
 * - Monitoramento via Bull Board
 * - Concorrência controlada
 */
export const importHistoryQueue = new Queue<ImportHistoryJob>(
  "ImportHistory",
  {
    redis: redisConfig,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 5000
      },
      removeOnComplete: 100, // Mantém últimos 100 jobs completos
      removeOnFail: false, // Mantém falhas para análise
      timeout: 300000 // 5 minutos máximo por job
    }
  }
);

/**
 * Worker assíncrono que processa jobs de importação
 */
importHistoryQueue.process(async (job) => {
  const { ticketId, companyId, periodMonths, downloadMedia = false, requestedBy, deferredCount = 0 } = job.data;
  
  logger.info(
    `[ImportHistoryQueue] Processando job ${job.id}: ` +
    `ticket=${ticketId}, period=${periodMonths}, ` +
    `downloadMedia=${downloadMedia}, requestedBy=${requestedBy}, deferredCount=${deferredCount}`
  );
  
  try {
    // Atualizar progresso do job
    await job.progress(10);
    
    // Executar importação
    const result = await ImportContactHistoryService({
      ticketId,
      companyId,
      periodMonths,
      downloadMedia
    });

    if (shouldDeferImport(result)) {
      const nextDeferredCount = deferredCount + 1;

      if (nextDeferredCount > MAX_DEFERRED_ATTEMPTS) {
        logger.warn(
          `[ImportHistoryQueue] Job ${job.id} excedeu limite de adiamentos: ` +
          `ticket=${ticketId}, reason=${result.reason}, deferredCount=${deferredCount}`
        );

        return {
          synced: 0,
          skipped: true,
          reason: `Import adiado em excesso: ${result.reason}`
        };
      }

      await importHistoryQueue.add({
        ticketId,
        companyId,
        periodMonths,
        downloadMedia,
        requestedBy,
        deferredCount: nextDeferredCount
      }, {
        delay: DEFER_DELAY_MS,
        jobId: `import-${ticketId}-deferred-${Date.now()}`,
        priority: requestedBy === "manual_import" ? 1 : 5
      });

      logger.warn(
        `[ImportHistoryQueue] Job ${job.id} adiado por sessão instável: ` +
        `ticket=${ticketId}, reason=${result.reason}, nextDeferredCount=${nextDeferredCount}, delayMs=${DEFER_DELAY_MS}`
      );

      await job.progress(100);
      return {
        synced: 0,
        skipped: true,
        deferred: true,
        reason: result.reason
      };
    }
    
    await job.progress(100);
    
    logger.info(
      `[ImportHistoryQueue] Job ${job.id} concluído: ` +
      `synced=${result.synced}, skipped=${result.skipped}`
    );
    
    return result;
    
  } catch (error) {
    logger.error(
      `[ImportHistoryQueue] Job ${job.id} falhou: ${(error as Error)?.message}`
    );
    throw error; // Re-throw para acionar retry
  }
});

/**
 * Event listeners para monitoramento
 */
importHistoryQueue.on("completed", (job, result) => {
  logger.info(
    `[ImportHistoryQueue] Job ${job.id} completed: ` +
    `${result.synced} mensagens sincronizadas`
  );
});

importHistoryQueue.on("failed", (job, err) => {
  logger.error(
    `[ImportHistoryQueue] Job ${job?.id} failed após ${job?.attemptsMade} tentativas: ` +
    `${err.message}`
  );
});

importHistoryQueue.on("stalled", (job) => {
  logger.warn(
    `[ImportHistoryQueue] Job ${job.id} travado (processando há mais de 30s sem progresso)`
  );
});

/**
 * Helper para adicionar job de importação à queue
 */
export const queueImportHistory = async (params: ImportHistoryJob): Promise<string> => {
  const job = await importHistoryQueue.add(params, {
    // Job options específicos (opcional)
    jobId: `import-${params.ticketId}-${Date.now()}`,
    priority: params.requestedBy === "manual_import" ? 1 : 5 // Manual tem prioridade
  });
  
  logger.info(
    `[ImportHistoryQueue] Job ${job.id} adicionado à queue: ` +
    `ticket=${params.ticketId}, period=${params.periodMonths}`
  );
  
  return job.id.toString();
};

/**
 * Helper para verificar status de um job
 */
export const getImportJobStatus = async (jobId: string) => {
  const job = await importHistoryQueue.getJob(jobId);
  
  if (!job) {
    return { status: "not_found" };
  }
  
  const state = await job.getState();
  const progress = job.progress();
  
  return {
    status: state,
    progress,
    data: job.data,
    attemptsMade: job.attemptsMade,
    finishedOn: job.finishedOn,
    failedReason: job.failedReason
  };
};

/**
 * Helper para limpar jobs antigos (manutenção)
 */
export const cleanOldImportJobs = async (olderThanHours: number = 24) => {
  const grace = olderThanHours * 60 * 60 * 1000;
  
  await importHistoryQueue.clean(grace, "completed");
  await importHistoryQueue.clean(grace * 7, "failed"); // Mantém falhas por 7x mais tempo
  
  logger.info(`[ImportHistoryQueue] Limpeza de jobs antigos concluída (>${olderThanHours}h)`);
};

export default importHistoryQueue;
