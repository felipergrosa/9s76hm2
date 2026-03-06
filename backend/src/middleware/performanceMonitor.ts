import { Request, Response, NextFunction } from "express";
import CacheManager from "../helpers/CacheManager";

interface PerformanceMetrics {
  endpoint: string;
  method: string;
  duration: number;
  timestamp: number;
  statusCode: number;
}

class PerformanceMonitor {
  private slowThreshold: number = 1000; // 1 segundo
  private criticalThreshold: number = 3000; // 3 segundos

  /**
   * Middleware para monitorar performance de requisições
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      const endpoint = `${req.method} ${req.path}`;

      // Captura quando a resposta termina
      res.on("finish", async () => {
        const duration = Date.now() - start;
        const statusCode = res.statusCode;

        // Log de requisições lentas
        if (duration > this.slowThreshold) {
          const level = duration > this.criticalThreshold ? "CRITICAL" : "WARN";
          console.warn(
            `[PERFORMANCE ${level}] ${endpoint} - ${duration}ms - Status: ${statusCode}`
          );
        }

        // Salva métricas no cache para análise
        await this.saveMetrics({
          endpoint,
          method: req.method,
          duration,
          timestamp: Date.now(),
          statusCode
        });

        // Incrementa contador de requisições por endpoint
        await CacheManager.incr(`perf:count:${endpoint}`, 3600); // TTL 1h
      });

      next();
    };
  }

  /**
   * Salva métricas no Redis
   */
  private async saveMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      const key = `perf:metrics:${metrics.endpoint}:${Date.now()}`;
      await CacheManager.set(key, metrics, 3600); // TTL 1h
    } catch (error) {
      // Não bloqueia a aplicação se falhar
      console.error("[PerformanceMonitor] Error saving metrics:", error);
    }
  }

  /**
   * Obtém estatísticas de performance
   */
  async getStats(endpoint?: string): Promise<any> {
    try {
      const pattern = endpoint 
        ? `perf:metrics:${endpoint}:*` 
        : "perf:metrics:*";
      
      // Implementação simplificada - em produção usar Redis Streams
      return {
        message: "Use Redis Streams ou Prometheus para métricas detalhadas",
        pattern
      };
    } catch (error) {
      console.error("[PerformanceMonitor] Error getting stats:", error);
      return null;
    }
  }

  /**
   * Limpa métricas antigas
   */
  async cleanup(): Promise<number> {
    try {
      return await CacheManager.delPattern("perf:metrics:*");
    } catch (error) {
      console.error("[PerformanceMonitor] Error cleaning up:", error);
      return 0;
    }
  }
}

export default new PerformanceMonitor();
