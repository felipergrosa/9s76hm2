/**
 * BullQueueMonitor - Monitor automático para prevenir travamentos na fila
 * 
 * Problema resolvido: Jobs podem ficar "stalled" (presos) quando:
 * - Worker trava durante processamento
 * - Processo é morto abruptamente
 * - Timeout de rede/Redis
 * 
 * Solução: Monitor periódico que detecta e limpa jobs presos automaticamente
 */

import Bull from "bull";
import logger from "../utils/logger";

interface QueueHealth {
  name: string;
  waiting: number;
  active: number;
  failed: number;
  stalled: number;
  cleaned: number;
}

class BullQueueMonitor {
  private queues: Map<string, Bull.Queue> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private readonly checkIntervalMs: number;
  private readonly stalledTimeoutMs: number;
  private readonly maxFailedJobs: number;

  constructor() {
    // Verificar a cada 30 segundos
    this.checkIntervalMs = parseInt(process.env.BULL_MONITOR_INTERVAL_MS || "30000");
    // Jobs stalled após 60 segundos
    this.stalledTimeoutMs = parseInt(process.env.BULL_STALLED_TIMEOUT_MS || "60000");
    // Limpar failed se exceder 100
    this.maxFailedJobs = parseInt(process.env.BULL_MAX_FAILED_JOBS || "100");
  }

  /**
   * Registra uma fila para monitoramento
   */
  registerQueue(name: string, queue: Bull.Queue): void {
    this.queues.set(name, queue);
    logger.info(`[BullMonitor] Fila "${name}" registrada para monitoramento`);
  }

  /**
   * Inicia monitoramento periódico
   */
  start(): void {
    if (this.intervalId) {
      logger.warn("[BullMonitor] Monitor já está rodando");
      return;
    }

    logger.info(`[BullMonitor] Iniciando monitoramento (intervalo=${this.checkIntervalMs}ms, stalledTimeout=${this.stalledTimeoutMs}ms)`);

    // Verificação inicial
    this.checkAllQueues();

    // Verificação periódica
    this.intervalId = setInterval(() => {
      this.checkAllQueues();
    }, this.checkIntervalMs);
  }

  /**
   * Para monitoramento
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info("[BullMonitor] Monitor parado");
    }
  }

  /**
   * Verifica saúde de todas as filas registradas
   */
  private async checkAllQueues(): Promise<void> {
    for (const [name, queue] of this.queues) {
      try {
        await this.checkQueueHealth(name, queue);
      } catch (err: any) {
        logger.error(`[BullMonitor] Erro ao verificar fila "${name}": ${err?.message}`);
      }
    }
  }

  /**
   * Verifica e corrige problemas em uma fila específica
   */
  private async checkQueueHealth(name: string, queue: Bull.Queue): Promise<QueueHealth> {
    const [waiting, active, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getFailedCount(),
    ]);

    const health: QueueHealth = {
      name,
      waiting,
      active,
      failed,
      stalled: 0,
      cleaned: 0,
    };

    // Log de saúde (apenas se houver problemas)
    if (waiting > 10 || active > 5 || failed > 10) {
      logger.warn(`[BullMonitor] Fila "${name}": waiting=${waiting}, active=${active}, failed=${failed}`);
    }

    // AÇÃO 1: Limpar jobs falhos se exceder limite
    if (failed > this.maxFailedJobs) {
      logger.warn(`[BullMonitor] Limpando ${failed} jobs falhos na fila "${name}"`);
      const cleaned = await queue.clean(0, "failed");
      health.cleaned = cleaned.length;
      logger.info(`[BullMonitor] Removidos ${health.cleaned} jobs falhos da fila "${name}"`);
    }

    // AÇÃO 2: Detectar e limpar jobs stalled
    // Bull não tem método direto para stalled, mas podemos verificar active jobs antigos
    const activeJobs = await queue.getActive();
    const now = Date.now();

    for (const job of activeJobs) {
      const processedOn = job.processedOn;
      if (processedOn) {
        const ageMs = now - processedOn;
        if (ageMs > this.stalledTimeoutMs) {
          health.stalled++;
          logger.warn(`[BullMonitor] Job ${job.id} na fila "${name}" está stalled (age=${Math.round(ageMs / 1000)}s)`);
          
          // Tentar mover para failed para que o clean possa remover
          try {
            await job.moveToFailed({ message: "Job stalled - auto cleaned" }, true);
          } catch (e) {
            // Ignorar erro se já foi processado
          }
        }
      }
    }

    // AÇÃO 3: Se muitos jobs stalled, limpar active
    if (health.stalled > 5) {
      logger.warn(`[BullMonitor] Muitos jobs stalled (${health.stalled}) na fila "${name}", limpando active`);
      await queue.clean(this.stalledTimeoutMs, "active");
    }

    return health;
  }

  /**
   * Retorna saúde atual de todas as filas
   */
  async getHealth(): Promise<QueueHealth[]> {
    const results: QueueHealth[] = [];
    for (const [name, queue] of this.queues) {
      try {
        const health = await this.checkQueueHealth(name, queue);
        results.push(health);
      } catch (err) {
        results.push({
          name,
          waiting: -1,
          active: -1,
          failed: -1,
          stalled: -1,
          cleaned: 0,
        });
      }
    }
    return results;
  }

  /**
   * Limpa todas as filas (usado no startup para evitar jobs antigos)
   */
  async cleanAllOnStartup(): Promise<void> {
    logger.info("[BullMonitor] Limpando jobs antigos no startup...");
    
    for (const [name, queue] of this.queues) {
      try {
        // Limpar jobs falhos
        const failedCleaned = await queue.clean(0, "failed");
        // Limpar jobs stalled (active antigos)
        const stalledCleaned = await queue.clean(this.stalledTimeoutMs, "active");
        
        if (failedCleaned.length > 0 || stalledCleaned.length > 0) {
          logger.info(`[BullMonitor] Fila "${name}": removidos ${failedCleaned.length} failed, ${stalledCleaned.length} stalled no startup`);
        }
      } catch (err: any) {
        logger.error(`[BullMonitor] Erro ao limpar fila "${name}" no startup: ${err?.message}`);
      }
    }
  }
}

// Singleton
export const bullQueueMonitor = new BullQueueMonitor();

export default BullQueueMonitor;
