/**
 * TurboFactory - Factory para criar instâncias do Turbo Connector
 * 
 * Decide qual engine usar baseado na configuração e disponibilidade.
 */

import { ITurboEngine, EngineType, EngineOrchestrator, BaileysAdapter, WebJSAdapter } from "./index";
import logger from "../../utils/logger";

// ============================================================================
// TIPOS
// ============================================================================

export interface TurboFactoryConfig {
  sessionId: string;
  companyId: number;
  whatsappId: number;
  sessionPath: string;
  
  // Engines habilitados (ordem de prioridade)
  engines?: EngineType[];
  
  // Fallback automático
  autoFallback?: boolean;
  
  // Modo de operação
  mode?: "performance" | "stability" | "hybrid";
}

// ============================================================================
// PRESET DE CONFIGURAÇÃO
// ============================================================================

const ENGINE_PRESETS: Record<string, EngineType[]> = {
  // Performance: só Baileys (mais rápido, menos memória)
  performance: ["baileys"],
  
  // Stability: só WEBJS (mais estável, mais memória)
  stability: ["webjs"],
  
  // Hybrid: Baileys primário, WEBJS fallback
  hybrid: ["baileys", "webjs"],
  
  // Default: hybrid
  default: ["baileys", "webjs"],
};

// ============================================================================
// FACTORY
// ============================================================================

export class TurboFactory {
  /**
   * Cria um EngineOrchestrator configurado com os engines especificados
   */
  static async createOrchestrator(config: TurboFactoryConfig): Promise<EngineOrchestrator> {
    const mode = config.mode || "hybrid";
    const engines = config.engines || ENGINE_PRESETS[mode] || ENGINE_PRESETS.default;
    
    logger.info(
      `[TurboFactory] Criando orchestrator para sessão ${config.sessionId} (mode: ${mode}, engines: ${engines.join(", ")})`
    );

    const orchestrator = new EngineOrchestrator({
      sessionId: config.sessionId,
      companyId: config.companyId,
      whatsappId: config.whatsappId,
      enabledEngines: engines,
      autoFallback: config.autoFallback ?? true,
      maxConsecutiveFailures: 3,
      healthCheckIntervalMs: 30000,
      backoffAfterFailureMs: 60000,
    });

    // Registrar engines
    for (let i = 0; i < engines.length; i++) {
      const engineType = engines[i];
      const engine = await this.createEngine(engineType, config);
      
      if (engine) {
        orchestrator.registerEngine(engine, engines.length - i); // Prioridade inversa
        logger.info(`[TurboFactory] Engine ${engineType} registrado (priority: ${engines.length - i})`);
      }
    }

    // Iniciar health check
    orchestrator.startHealthCheck();

    return orchestrator;
  }

  /**
   * Cria um engine específico
   */
  static async createEngine(type: EngineType, config: TurboFactoryConfig): Promise<ITurboEngine | null> {
    switch (type) {
      case "baileys":
        return new BaileysAdapter({
          sessionId: config.sessionId,
          companyId: config.companyId,
          whatsappId: config.whatsappId,
          sessionPath: config.sessionPath,
        });

      case "webjs":
        return new WebJSAdapter({
          sessionId: config.sessionId,
          companyId: config.companyId,
          whatsappId: config.whatsappId,
          sessionPath: config.sessionPath,
        });

      case "venom":
        // TODO: Implementar VenomAdapter na Fase 3
        logger.warn(`[TurboFactory] VenomAdapter não implementado ainda`);
        return null;

      case "gows":
        // TODO: Implementar GOWSAdapter na Fase 4 (Go microservice)
        logger.warn(`[TurboFactory] GOWSAdapter não implementado ainda`);
        return null;

      default:
        logger.error(`[TurboFactory] Engine desconhecido: ${type}`);
        return null;
    }
  }

  /**
   * Cria um engine único (sem orchestrator) para casos simples
   */
  static async createSingleEngine(type: EngineType, config: TurboFactoryConfig): Promise<ITurboEngine | null> {
    return this.createEngine(type, config);
  }

  /**
   * Retorna informações sobre os engines disponíveis
   */
  static getAvailableEngines(): Array<{
    type: EngineType;
    name: string;
    description: string;
    memoryUsage: number;
    latency: number;
    available: boolean;
  }> {
    return [
      {
        type: "baileys",
        name: "Baileys",
        description: "Socket-based WhatsApp Web API (sem browser)",
        memoryUsage: 50,
        latency: 50,
        available: true,
      },
      {
        type: "webjs",
        name: "whatsapp-web.js",
        description: "Puppeteer-based WhatsApp Web API (browser automation)",
        memoryUsage: 300,
        latency: 200,
        available: true,
      },
      {
        type: "venom",
        name: "Venom",
        description: "Puppeteer avançado com features extras",
        memoryUsage: 300,
        latency: 200,
        available: false, // Fase 3
      },
      {
        type: "gows",
        name: "GOWS",
        description: "Go-based WebSocket API (ultra performático)",
        memoryUsage: 20,
        latency: 30,
        available: false, // Fase 4
      },
    ];
  }

  /**
   * Recomenda o melhor engine baseado no caso de uso
   */
  static recommendEngine(useCase: "high_volume" | "stability" | "low_memory" | "features"): EngineType {
    switch (useCase) {
      case "high_volume":
        // Alto volume: Baileys (rápido) com fallback para WEBJS
        return "baileys";

      case "stability":
        // Estabilidade: WEBJS (mais estável)
        return "webjs";

      case "low_memory":
        // Baixa memória: Baileys (sem browser)
        return "baileys";

      case "features":
        // Features avançadas: WEBJS (typing simulation, etc)
        return "webjs";

      default:
        return "baileys";
    }
  }
}

export default TurboFactory;
