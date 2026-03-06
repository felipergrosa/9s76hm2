import { Router } from "express";
import { BullScheduler } from "../queue/BullScheduler";
import { EventTrigger } from "../queue/EventTrigger";
import isAuth from "../middleware/isAuth";
import logger from "../utils/logger";

const bullQueueRoutes = Router();

/**
 * GET /api/bull-queues/stats
 * Retorna estatísticas de todas as filas Bull ativas
 * Requer autenticação
 */
bullQueueRoutes.get("/stats", isAuth, async (req, res) => {
  try {
    const queues = BullScheduler.getActiveQueues();
    const stats: Record<string, any> = {};

    for (const queueName of queues) {
      const queueStats = await BullScheduler.getStats(queueName);
      if (queueStats) {
        stats[queueName] = queueStats;
      }
    }

    // Estatísticas do EventTrigger
    const eventStats = EventTrigger.getStats();

    return res.json({
      success: true,
      queues: stats,
      eventTrigger: eventStats,
      totalQueues: queues.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error("[BullQueueRoutes] Erro ao obter stats", { error: error.message });
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/bull-queues/health
 * Health check das filas
 */
bullQueueRoutes.get("/health", async (req, res) => {
  try {
    const queues = BullScheduler.getActiveQueues();
    const health: Record<string, string> = {};
    let hasDegraded = false;

    for (const queueName of queues) {
      const stats = await BullScheduler.getStats(queueName);
      if (stats) {
        // Fila está saudável se não tem muitos jobs falhos
        const totalProcessed = stats.completed + stats.failed;
        const failedRatio = totalProcessed > 0 ? stats.failed / totalProcessed : 0;
        
        if (failedRatio > 0.2) {
          health[queueName] = "unhealthy";
          hasDegraded = true;
        } else if (failedRatio > 0.05) {
          health[queueName] = "degraded";
          hasDegraded = true;
        } else {
          health[queueName] = "healthy";
        }
      } else {
        health[queueName] = "unknown";
      }
    }

    const statusCode = hasDegraded ? 503 : 200;

    return res.status(statusCode).json({
      success: true,
      status: hasDegraded ? "degraded" : "healthy",
      queues: health,
      totalQueues: queues.length,
    });
  } catch (error: any) {
    logger.error("[BullQueueRoutes] Erro no health check", { error: error.message });
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default bullQueueRoutes;
