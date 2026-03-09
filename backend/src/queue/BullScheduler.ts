import BullQueue from "bull";
import { REDIS_URI_MSG_CONN } from "../config/redis";
import logger from "../utils/logger";

/**
 * ============================================================================
 * BULL SCHEDULER - Sistema Centralizado de Agendamento de Jobs
 * ============================================================================
 * 
 * Este módulo fornece uma interface unificada para agendamento de jobs
 * via Bull Queue, substituindo cronjobs tradicionais por um sistema
 * event-driven mais eficiente.
 * 
 * VANTAGENS:
 * - Zero overhead: jobs só executam quando necessário (sem polling)
 * - Escalabilidade: suporta milhares de jobs sem degradação
 * - Persistência: jobs sobrevivem a restart do servidor
 * - Retry automático: configuração padronizada de tentativas
 * - Deduplicação: jobId único evita execuções duplicadas
 * 
 * USO BÁSICO:
 * ```typescript
 * import { BullScheduler } from "./queue/BullScheduler";
 * 
 * // Agendar job imediato
 * await BullScheduler.schedule('MeuJob', { dados: 'valor' });
 * 
 * // Agendar com delay (executa daqui a 1 hora)
 * await BullScheduler.schedule('MeuJob', { dados: 'valor' }, {
 *   delay: 3600000,
 *   jobId: 'job-unico-123' // evita duplicatas
 * });
 * 
 * // Agendar recorrente (CRON via Bull)
 * await BullScheduler.scheduleRecurring('BackupDiario', {}, '0 2 * * *');
 * ```
 * 
 * ============================================================================
 */

// Configuracoes padrao para todos os jobs
const DEFAULT_JOB_OPTIONS: BullQueue.JobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 60000,
  },
  removeOnComplete: true,
  removeOnFail: false,
  timeout: 300000,
};

// Configuracoes da fila
const QUEUE_OPTIONS: BullQueue.QueueOptions = {
  redis: REDIS_URI_MSG_CONN,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
  settings: {
    stalledInterval: 30000,
    maxStalledCount: 2,
  },
};

// Cache de filas criadas
const queueCache = new Map<string, BullQueue.Queue>();

// Obtem ou cria uma fila Bull
function getQueue(name: string): BullQueue.Queue {
  const dbName = process.env.DB_NAME || "whaticket";
  const queueName = `${dbName}-${name}`;
  
  if (!queueCache.has(queueName)) {
    const queue = new BullQueue(queueName, QUEUE_OPTIONS);
    
    queue.on("completed", (job) => {
      logger.debug(`[BullScheduler] Job ${job.id} completado: ${queueName}`);
    });
    
    queue.on("failed", (job, err) => {
      logger.error(`[BullScheduler] Job ${job.id} falhou: ${queueName}`, {
        error: err.message,
        attempts: job.attemptsMade,
      });
    });
    
    queue.on("stalled", (jobId) => {
      logger.warn(`[BullScheduler] Job ${jobId} stalled: ${queueName}`);
    });
    
    queueCache.set(queueName, queue);
  }
  
  return queueCache.get(queueName)!;
}

// Interface para opcoes de agendamento
export interface ScheduleOptions {
  delay?: number;
  jobId?: string;
  attempts?: number;
  priority?: number;
  timestamp?: number;
}

// Scheduler centralizado de jobs Bull
export class BullScheduler {
  
  // Agenda um job para execucao
  static async schedule<T = any>(
    jobName: string,
    data: T,
    options: ScheduleOptions = {}
  ): Promise<BullQueue.Job<T>> {
    const queue = getQueue(jobName);
    
    const jobOptions: BullQueue.JobOptions = {
      ...DEFAULT_JOB_OPTIONS,
      delay: options.delay,
      jobId: options.jobId,
      priority: options.priority,
      attempts: options.attempts,
      timestamp: options.timestamp,
    };
    
    // Remover undefined values
    Object.keys(jobOptions).forEach(key => {
      if (jobOptions[key as keyof BullQueue.JobOptions] === undefined) {
        delete jobOptions[key as keyof BullQueue.JobOptions];
      }
    });
    
    const job = await queue.add(data, jobOptions);
    
    logger.info(`[BullScheduler] Job ${jobName} agendado`, {
      jobId: job.id,
      customId: options.jobId,
      delay: options.delay ? `${Math.floor(options.delay / 1000)}s` : 'imediato',
    });
    
    return job;
  }
  
  // Agenda um job recorrente (substitui cron)
  static async scheduleRecurring<T = any>(
    jobName: string,
    data: T,
    cronExpression: string,
    options: Omit<ScheduleOptions, 'delay' | 'timestamp'> = {}
  ): Promise<BullQueue.Job<T>> {
    const queue = getQueue(jobName);
    
    const jobOptions: BullQueue.JobOptions = {
      ...DEFAULT_JOB_OPTIONS,
      jobId: options.jobId || `recurring-${jobName}`,
      priority: options.priority,
      attempts: options.attempts,
      repeat: {
        cron: cronExpression,
      },
    };
    
    const job = await queue.add(data, jobOptions);
    
    logger.info(`[BullScheduler] Job recorrente ${jobName} configurado`, {
      jobId: job.id,
      cron: cronExpression,
    });
    
    return job;
  }
  
  // Cancela um job agendado pelo ID
  static async cancel(jobName: string, jobId: string): Promise<boolean> {
    try {
      const queue = getQueue(jobName);
      const job = await queue.getJob(jobId);
      
      if (job) {
        await job.remove();
        logger.info(`[BullScheduler] Job ${jobName}:${jobId} cancelado`);
        return true;
      }
      
      return false;
    } catch (error: any) {
      logger.error(`[BullScheduler] Erro ao cancelar job ${jobName}:${jobId}`, {
        error: error.message,
      });
      return false;
    }
  }
  
  // Remove job anterior e agenda novo (atualizacao)
  static async reschedule<T = any>(
    jobName: string,
    jobId: string,
    data: T,
    options: ScheduleOptions = {}
  ): Promise<BullQueue.Job<T>> {
    await this.cancel(jobName, jobId);
    return this.schedule(jobName, data, { ...options, jobId });
  }
  
  // Verifica se um job existe na fila
  static async exists(jobName: string, jobId: string): Promise<boolean> {
    try {
      const queue = getQueue(jobName);
      const job = await queue.getJob(jobId);
      return !!job;
    } catch {
      return false;
    }
  }
  
  // Obtem estatisticas de uma fila
  static async getStats(jobName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  } | null> {
    try {
      const queue = getQueue(jobName);
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);
      
      return { waiting, active, completed, failed, delayed };
    } catch (error: any) {
      logger.error(`[BullScheduler] Erro ao obter stats de ${jobName}`, {
        error: error.message,
      });
      return null;
    }
  }
  
  // Lista todas as filas ativas
  static getActiveQueues(): string[] {
    return Array.from(queueCache.keys());
  }
  
  // Limpa todos os jobs de uma fila
  static async clearQueue(
    jobName: string,
    status: 'completed' | 'failed' | 'waiting' | 'delayed' | 'paused'
  ): Promise<void> {
    try {
      const queue = getQueue(jobName);
      
      switch (status) {
        case 'completed':
          await queue.clean(0, 'completed');
          break;
        case 'failed':
          await queue.clean(0, 'failed');
          break;
        case 'waiting':
          const waiting = await queue.getWaiting();
          await Promise.all(waiting.map(job => job.remove()));
          break;
        case 'delayed':
          const delayed = await queue.getDelayed();
          await Promise.all(delayed.map(job => job.remove()));
          break;
        case 'paused':
          await queue.resume();
          break;
      }
      
      logger.info(`[BullScheduler] Fila ${jobName} limpa: ${status}`);
    } catch (error: any) {
      logger.error(`[BullScheduler] Erro ao limpar fila ${jobName}`, {
        error: error.message,
      });
    }
  }
}

export default BullScheduler;
