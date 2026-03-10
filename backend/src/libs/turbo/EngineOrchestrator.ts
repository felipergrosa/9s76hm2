/**
 * Engine Orchestrator - Gerencia múltiplos engines de WhatsApp
 * 
 * Responsabilidades:
 * - Auto-fallback entre engines quando um falha
 * - Feature routing (escolher melhor engine para cada operação)
 * - Health monitoring de cada engine
 * - Balanceamento de carga
 */

import { ITurboEngine, EngineType, EngineInfo, HealthStatus, TurboMessage, TurboContact, TurboGroup } from "./ITurboEngine";
import logger from "../../utils/logger";

// ============================================================================
// TIPOS
// ============================================================================

interface EngineEntry {
  engine: ITurboEngine;
  priority: number;
  enabled: boolean;
  lastHealthCheck: number;
  consecutiveFailures: number;
  lastFailure: number;
}

interface OperationRouting {
  operation: string;
  preferredEngine: EngineType;
  fallbackEngines: EngineType[];
}

interface OrchestratorConfig {
  sessionId: string;
  companyId: number;
  whatsappId: number;
  
  // Engines habilitados (ordem de prioridade)
  enabledEngines: EngineType[];
  
  // Fallback automático
  autoFallback: boolean;
  maxConsecutiveFailures: number; // Antes de marcar como unhealthy
  healthCheckIntervalMs: number;
  backoffAfterFailureMs: number;
  
  // Feature routing customizado
  customRouting?: OperationRouting[];
}

// ============================================================================
// FEATURE ROUTING PADRÃO
// ============================================================================

const DEFAULT_FEATURE_ROUTING: OperationRouting[] = [
  // Mensagens - priorizar velocidade (Baileys)
  { operation: "sendText", preferredEngine: "baileys", fallbackEngines: ["webjs", "venom"] },
  { operation: "sendMedia", preferredEngine: "baileys", fallbackEngines: ["webjs", "venom"] },
  { operation: "sendDocument", preferredEngine: "baileys", fallbackEngines: ["webjs", "venom"] },
  { operation: "sendReaction", preferredEngine: "baileys", fallbackEngines: ["webjs"] },
  
  // QR Code - priorizar estabilidade (WEBJS)
  { operation: "connect", preferredEngine: "baileys", fallbackEngines: ["webjs"] },
  
  // Histórico - Baileys bugado, usar WEBJS
  { operation: "fetchHistory", preferredEngine: "webjs", fallbackEngines: ["venom"] },
  
  // LID Resolution - WEBJS mais estável
  { operation: "resolveLid", preferredEngine: "webjs", fallbackEngines: ["venom", "baileys"] },
  
  // Profile Pictures - Venom tem features avançadas
  { operation: "getProfilePicture", preferredEngine: "venom", fallbackEngines: ["webjs", "baileys"] },
  
  // Grupos - Venom tem operações mais completas
  { operation: "groupOperations", preferredEngine: "venom", fallbackEngines: ["webjs", "baileys"] },
  
  // Labels - WPPConnect (não implementado ainda)
  { operation: "labels", preferredEngine: "venom", fallbackEngines: [] },
  
  // Typing simulation - Venom (anti-detecção)
  { operation: "simulateTyping", preferredEngine: "venom", fallbackEngines: ["webjs"] },
  
  // Health check - Baileys (overhead mínimo)
  { operation: "ping", preferredEngine: "baileys", fallbackEngines: ["webjs"] },
];

// ============================================================================
// ENGINE ORCHESTRATOR
// ============================================================================

export class EngineOrchestrator {
  private engines: Map<EngineType, EngineEntry> = new Map();
  private config: OrchestratorConfig;
  private featureRouting: OperationRouting[];
  private healthCheckTimer?: NodeJS.Timeout;
  private currentPrimaryEngine: EngineType;

  constructor(config: OrchestratorConfig) {
    this.config = {
      autoFallback: true,
      maxConsecutiveFailures: 3,
      healthCheckIntervalMs: 30000, // 30 segundos
      backoffAfterFailureMs: 60000, // 1 minuto
      enabledEngines: ["baileys"], // Por padrão só Baileys
      ...config,
    };
    
    this.featureRouting = [...DEFAULT_FEATURE_ROUTING, ...(config.customRouting || [])];
    this.currentPrimaryEngine = this.config.enabledEngines[0] || "baileys";
  }

  // ============================================================================
  // GERENCIAMENTO DE ENGINES
  // ============================================================================

  /**
   * Registra um engine no orchestrator
   */
  registerEngine(engine: ITurboEngine, priority: number = 0): void {
    const entry: EngineEntry = {
      engine,
      priority,
      enabled: true,
      lastHealthCheck: Date.now(),
      consecutiveFailures: 0,
      lastFailure: 0,
    };
    
    this.engines.set(engine.type, entry);
    logger.info(
      `[TurboOrchestrator] Engine registrado: ${engine.type} (priority: ${priority})`
    );
  }

  /**
   * Remove um engine do orchestrator
   */
  async unregisterEngine(type: EngineType): Promise<void> {
    const entry = this.engines.get(type);
    if (entry) {
      await entry.engine.destroy();
      this.engines.delete(type);
      logger.info(`[TurboOrchestrator] Engine removido: ${type}`);
    }
  }

  /**
   * Retorna todos os engines registrados
   */
  getEngines(): EngineType[] {
    return Array.from(this.engines.keys());
  }

  /**
   * Retorna o engine primário atual
   */
  getPrimaryEngine(): ITurboEngine | null {
    const entry = this.engines.get(this.currentPrimaryEngine);
    return entry?.enabled ? entry.engine : null;
  }

  /**
   * Define o engine primário manualmente
   */
  setPrimaryEngine(type: EngineType): void {
    if (this.engines.has(type)) {
      this.currentPrimaryEngine = type;
      logger.info(`[TurboOrchestrator] Engine primário alterado para: ${type}`);
    }
  }

  // ============================================================================
  // FEATURE ROUTING
  // ============================================================================

  /**
   * Retorna o melhor engine para uma operação específica
   */
  getEngineForOperation(operation: string): ITurboEngine | null {
    // Buscar routing para a operação
    const routing = this.featureRouting.find(r => r.operation === operation);
    
    if (!routing) {
      // Sem routing definido, usar engine primário
      return this.getPrimaryEngine();
    }
    
    // Tentar engine preferido
    const preferredEntry = this.engines.get(routing.preferredEngine);
    if (preferredEntry && this.isEngineHealthy(preferredEntry)) {
      return preferredEntry.engine;
    }
    
    // Fallback para engines alternativos
    for (const fallbackType of routing.fallbackEngines) {
      const fallbackEntry = this.engines.get(fallbackType);
      if (fallbackEntry && this.isEngineHealthy(fallbackEntry)) {
        logger.info(
          `[TurboOrchestrator] Fallback: ${routing.preferredEngine} -> ${fallbackType} para ${operation}`
        );
        return fallbackEntry.engine;
      }
    }
    
    // Nenhum engine saudável, retornar primário mesmo assim
    logger.warn(
      `[TurboOrchestrator] Nenhum engine saudável para ${operation}, usando primário`
    );
    return this.getPrimaryEngine();
  }

  /**
   * Verifica se um engine está saudável
   */
  private isEngineHealthy(entry: EngineEntry): boolean {
    if (!entry.enabled) return false;
    
    // Se teve muitas falhas consecutivas, verificar backoff
    if (entry.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      const timeSinceFailure = Date.now() - entry.lastFailure;
      if (timeSinceFailure < this.config.backoffAfterFailureMs) {
        return false; // Ainda em backoff
      }
      // Passou o backoff, resetar e tentar novamente
      entry.consecutiveFailures = 0;
    }
    
    return entry.engine.getHealth() !== "unhealthy";
  }

  // ============================================================================
  // EXECUÇÃO COM FALLBACK AUTOMÁTICO
  // ============================================================================

  /**
   * Executa uma operação com fallback automático
   */
  async execute<T>(
    operation: string,
    fn: (engine: ITurboEngine) => Promise<T>
  ): Promise<T> {
    const engine = this.getEngineForOperation(operation);
    
    if (!engine) {
      throw new Error(`[TurboOrchestrator] Nenhum engine disponível para ${operation}`);
    }
    
    try {
      const result = await fn(engine);
      this.recordSuccess(engine.type);
      return result;
    } catch (error: any) {
      this.recordFailure(engine.type, error);
      
      // Tentar fallback
      if (this.config.autoFallback) {
        const fallbackEngine = this.getFallbackEngine(operation, engine.type);
        if (fallbackEngine) {
          logger.warn(
            `[TurboOrchestrator] Fallback automático: ${engine.type} -> ${fallbackEngine.type} para ${operation}`
          );
          
          try {
            const result = await fn(fallbackEngine);
            this.recordSuccess(fallbackEngine.type);
            return result;
          } catch (fallbackError: any) {
            this.recordFailure(fallbackEngine.type, fallbackError);
            throw fallbackError;
          }
        }
      }
      
      throw error;
    }
  }

  /**
   * Retorna um engine de fallback para uma operação
   */
  private getFallbackEngine(operation: string, failedType: EngineType): ITurboEngine | null {
    const routing = this.featureRouting.find(r => r.operation === operation);
    
    if (!routing) {
      // Sem routing, tentar qualquer outro engine habilitado
      for (const [type, entry] of this.engines) {
        if (type !== failedType && this.isEngineHealthy(entry)) {
          return entry.engine;
        }
      }
      return null;
    }
    
    // Tentar engines de fallback do routing
    for (const fallbackType of routing.fallbackEngines) {
      if (fallbackType === failedType) continue;
      
      const entry = this.engines.get(fallbackType);
      if (entry && this.isEngineHealthy(entry)) {
        return entry.engine;
      }
    }
    
    return null;
  }

  // ============================================================================
  // TRACKING DE SUCESSO/FALHA
  // ============================================================================

  /**
   * Registra um sucesso para um engine
   */
  private recordSuccess(type: EngineType): void {
    const entry = this.engines.get(type);
    if (entry) {
      entry.consecutiveFailures = 0;
      entry.lastHealthCheck = Date.now();
    }
  }

  /**
   * Registra uma falha para um engine
   */
  private recordFailure(type: EngineType, error: Error): void {
    const entry = this.engines.get(type);
    if (entry) {
      entry.consecutiveFailures++;
      entry.lastFailure = Date.now();
      
      logger.warn(
        `[TurboOrchestrator] Engine ${type} falhou (${entry.consecutiveFailures}/${this.config.maxConsecutiveFailures}): ${error.message}`
      );
      
      // Se atingiu limite, marcar como unhealthy
      if (entry.consecutiveFailures >= this.config.maxConsecutiveFailures) {
        logger.error(
          `[TurboOrchestrator] Engine ${type} marcado como UNHEALTHY após ${entry.consecutiveFailures} falhas`
        );
      }
    }
  }

  // ============================================================================
  // HEALTH CHECK
  // ============================================================================

  /**
   * Inicia health check periódico
   */
  startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.healthCheckTimer = setInterval(
      () => this.runHealthCheck(),
      this.config.healthCheckIntervalMs
    );
    
    logger.info(
      `[TurboOrchestrator] Health check iniciado (interval: ${this.config.healthCheckIntervalMs}ms)`
    );
  }

  /**
   * Para health check
   */
  stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Executa health check em todos os engines
   */
  private async runHealthCheck(): Promise<void> {
    for (const [type, entry] of this.engines) {
      if (!entry.enabled) continue;
      
      // Ignorar engines não conectados (não contar como falha)
      const status = entry.engine.getStatus();
      if (status === "disconnected" || status === "connecting") {
        logger.debug(`[TurboOrchestrator] Engine ${type} não conectado (${status}), pulando health check`);
        continue;
      }
      
      try {
        const isHealthy = await entry.engine.ping();
        
        if (isHealthy) {
          // Resetar falhas se ping bem-sucedido
          if (entry.consecutiveFailures > 0) {
            logger.info(
              `[TurboOrchestrator] Engine ${type} recuperado (${entry.consecutiveFailures} falhas anteriores)`
            );
            entry.consecutiveFailures = 0;
          }
        } else {
          this.recordFailure(type, new Error("Ping failed"));
        }
      } catch (error: any) {
        this.recordFailure(type, error);
      }
      
      entry.lastHealthCheck = Date.now();
    }
  }

  /**
   * Retorna status de saúde de todos os engines
   */
  getHealthReport(): Record<EngineType, {
    health: HealthStatus;
    consecutiveFailures: number;
    lastHealthCheck: number;
    enabled: boolean;
  }> {
    const report: any = {};
    
    for (const [type, entry] of this.engines) {
      report[type] = {
        health: entry.engine.getHealth(),
        consecutiveFailures: entry.consecutiveFailures,
        lastHealthCheck: entry.lastHealthCheck,
        enabled: entry.enabled,
      };
    }
    
    return report;
  }

  // ============================================================================
  // PROXY PARA OPERAÇÕES COMUNS
  // ============================================================================

  /**
   * Envia texto usando o melhor engine disponível
   */
  async sendText(to: string, text: string): Promise<TurboMessage> {
    return this.execute("sendText", engine => engine.sendText(to, text));
  }

  /**
   * Envia mídia usando o melhor engine disponível
   */
  async sendMedia(
    to: string,
    media: Buffer | string,
    type: "image" | "video" | "audio" | "document",
    options?: { caption?: string; filename?: string; mimetype?: string }
  ): Promise<TurboMessage> {
    return this.execute("sendMedia", engine => engine.sendMedia(to, media, type, options));
  }

  /**
   * Busca histórico usando o melhor engine disponível
   */
  async fetchHistory(jid: string, options?: { limit?: number; before?: string; after?: string }): Promise<TurboMessage[]> {
    return this.execute("fetchHistory", engine => engine.fetchHistory(jid, options));
  }

  /**
   * Resolve LID usando o melhor engine disponível
   */
  async resolveLid(lid: string): Promise<string | null> {
    return this.execute("resolveLid", engine => engine.resolveLid(lid));
  }

  /**
   * Obtém foto de perfil usando o melhor engine disponível
   */
  async getProfilePicture(jid: string): Promise<string | null> {
    return this.execute("getProfilePicture", engine => engine.getProfilePicture(jid));
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Destrói todos os engines e para health check
   */
  async destroy(): Promise<void> {
    this.stopHealthCheck();
    
    for (const [type, entry] of this.engines) {
      try {
        await entry.engine.destroy();
        logger.info(`[TurboOrchestrator] Engine ${type} destruído`);
      } catch (error: any) {
        logger.error(`[TurboOrchestrator] Erro ao destruir engine ${type}: ${error.message}`);
      }
    }
    
    this.engines.clear();
  }
}

export default EngineOrchestrator;
