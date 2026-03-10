/**
 * TurboIntegration - Helper para integrar Turbo Connector com wbot.ts
 * 
 * Fornece funções para habilitar/desabilitar o Turbo Connector
 * sem modificar o código existente do wbot.ts.
 */

import Whatsapp from "../models/Whatsapp";
import { createTurboWrapper, TurboWrapper } from "../libs/turbo";
import { WASocket } from "@whiskeysockets/baileys";
import logger from "../utils/logger";
import path from "path";
import fs from "fs";

// ============================================================================
// TIPOS
// ============================================================================

export interface TurboIntegrationConfig {
  enabled: boolean;
  mode: "performance" | "stability" | "hybrid";
  engines?: string[];
  fallbackEnabled: boolean;
  healthCheckInterval: number;
}

// ============================================================================
// CONFIGURAÇÃO PADRÃO
// ============================================================================

const DEFAULT_CONFIG: TurboIntegrationConfig = {
  enabled: process.env.TURBO_ENABLED === "true",
  mode: (process.env.TURBO_MODE as any) || "hybrid",
  engines: process.env.TURBO_ENGINES?.split(",").map(e => e.trim()),
  fallbackEnabled: process.env.TURBO_FALLBACK !== "false",
  healthCheckInterval: parseInt(process.env.TURBO_HEALTH_CHECK_INTERVAL || "30000"),
};

// ============================================================================
// CACHE DE WRAPPERS
// ============================================================================

const turboWrappers = new Map<number, TurboWrapper>();

// ============================================================================
// FUNÇÕES DE INTEGRAÇÃO
// ============================================================================

/**
 * Verifica se o Turbo Connector está habilitado
 */
export function isTurboEnabled(): boolean {
  return DEFAULT_CONFIG.enabled;
}

/**
 * Retorna a configuração atual do Turbo Connector
 */
export function getTurboConfig(): TurboIntegrationConfig {
  return { ...DEFAULT_CONFIG };
}

/**
 * Cria um socket WhatsApp usando Turbo Connector ou Baileys direto
 * 
 * @param whatsapp - Modelo do WhatsApp
 * @param sessionPath - Caminho da sessão
 * @param baileysSocket - Socket Baileys já criado (fallback)
 * @returns Socket WASocket (TurboWrapper ou Baileys)
 */
export async function createTurboSocket(
  whatsapp: Whatsapp,
  sessionPath: string,
  baileysSocket?: WASocket
): Promise<WASocket | TurboWrapper> {
  if (!DEFAULT_CONFIG.enabled) {
    // Turbo desabilitado, usar Baileys direto
    logger.info(`[TurboIntegration] Turbo desabilitado, usando Baileys direto para whatsappId=${whatsapp.id}`);
    return baileysSocket!;
  }

  logger.info(`[TurboIntegration] Criando TurboWrapper para whatsappId=${whatsapp.id} (mode: ${DEFAULT_CONFIG.mode})`);

  try {
    // Criar diretório de sessão se não existir
    const fullPath = path.join(sessionPath, `whatsapp-${whatsapp.id}`);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    // Criar wrapper
    const wrapper = await createTurboWrapper({
      whatsapp,
      sessionPath: fullPath,
      mode: DEFAULT_CONFIG.mode,
      engines: DEFAULT_CONFIG.engines as any,
    });

    // Cachear wrapper
    turboWrappers.set(whatsapp.id, wrapper);

    logger.info(`[TurboIntegration] TurboWrapper criado com sucesso para whatsappId=${whatsapp.id}`);

    return wrapper;
  } catch (error: any) {
    logger.error(`[TurboIntegration] Erro ao criar TurboWrapper: ${error.message}`);
    
    // Fallback para Baileys se Turbo falhar
    if (baileysSocket) {
      logger.warn(`[TurboIntegration] Fallback para Baileys direto`);
      return baileysSocket;
    }
    
    throw error;
  }
}

/**
 * Obtém um TurboWrapper existente
 */
export function getTurboWrapper(whatsappId: number): TurboWrapper | undefined {
  return turboWrappers.get(whatsappId);
}

/**
 * Remove um TurboWrapper do cache
 */
export function removeTurboWrapper(whatsappId: number): void {
  const wrapper = turboWrappers.get(whatsappId);
  
  if (wrapper) {
    wrapper.end().catch(err => {
      logger.error(`[TurboIntegration] Erro ao finalizar wrapper: ${err.message}`);
    });
    
    turboWrappers.delete(whatsappId);
    logger.info(`[TurboIntegration] TurboWrapper removido para whatsappId=${whatsappId}`);
  }
}

/**
 * Retorna health report de todos os wrappers
 */
export function getAllTurboHealthReports(): Record<number, any> {
  const reports: Record<number, any> = {};
  
  for (const [id, wrapper] of turboWrappers) {
    try {
      // Obter health report do orchestrator interno
      const orchestrator = (wrapper as any).orchestrator;
      if (orchestrator) {
        reports[id] = orchestrator.getHealthReport();
      }
    } catch (error: any) {
      reports[id] = { error: error.message };
    }
  }
  
  return reports;
}

/**
 * Força fallback para um engine específico
 */
export function forceEngine(whatsappId: number, engine: "baileys" | "webjs"): boolean {
  const wrapper = turboWrappers.get(whatsappId);
  
  if (!wrapper) {
    logger.warn(`[TurboIntegration] Wrapper não encontrado para whatsappId=${whatsappId}`);
    return false;
  }
  
  try {
    const orchestrator = (wrapper as any).orchestrator;
    if (orchestrator) {
      orchestrator.setPrimaryEngine(engine);
      logger.info(`[TurboIntegration] Engine forçado para ${engine} no whatsappId=${whatsappId}`);
      return true;
    }
  } catch (error: any) {
    logger.error(`[TurboIntegration] Erro ao forçar engine: ${error.message}`);
  }
  
  return false;
}

/**
 * Reseta contadores de falha de todos os engines
 */
export function resetAllFailureCounters(): void {
  for (const [id, wrapper] of turboWrappers) {
    try {
      const orchestrator = (wrapper as any).orchestrator;
      if (orchestrator) {
        // Resetar via health check
        for (const engine of orchestrator.getEngines()) {
          const entry = (orchestrator as any).engines.get(engine);
          if (entry) {
            entry.consecutiveFailures = 0;
          }
        }
      }
    } catch (error: any) {
      logger.error(`[TurboIntegration] Erro ao resetar contadores: ${error.message}`);
    }
  }
  
  logger.info(`[TurboIntegration] Contadores de falha resetados`);
}

// ============================================================================
// DECORATOR PARA wbot.ts
// ============================================================================

/**
 * Decorator para adicionar Turbo Connector ao wbot.ts
 * 
 * Uso:
 * ```typescript
 * // No wbot.ts
 * import { withTurboSupport } from "../helpers/TurboIntegration";
 * 
 * const session = makeWASocket(config);
 * const turboSession = await withTurboSupport(session, whatsapp, sessionPath);
 * ```
 */
export async function withTurboSupport(
  baileysSocket: WASocket,
  whatsapp: Whatsapp,
  sessionPath: string
): Promise<WASocket> {
  if (!DEFAULT_CONFIG.enabled) {
    return baileysSocket;
  }

  const wrapper = await createTurboSocket(whatsapp, sessionPath, baileysSocket);
  
  // Se é um TurboWrapper, retornar como WASocket
  if (wrapper instanceof TurboWrapper) {
    // O wrapper já implementa a interface do WASocket
    return wrapper as unknown as WASocket;
  }
  
  // Se não, retornar o socket original
  return baileysSocket;
}

// ============================================================================
// MIDDLEWARE PARA ROTAS
// ============================================================================

/**
 * Middleware para adicionar informações do Turbo às requisições
 */
export function turboStatusMiddleware(req: any, res: any, next: Function): void {
  req.turbo = {
    enabled: DEFAULT_CONFIG.enabled,
    mode: DEFAULT_CONFIG.mode,
    wrappers: turboWrappers.size,
  };
  next();
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  isTurboEnabled,
  getTurboConfig,
  createTurboSocket,
  getTurboWrapper,
  removeTurboWrapper,
  getAllTurboHealthReports,
  forceEngine,
  resetAllFailureCounters,
  withTurboSupport,
  turboStatusMiddleware,
};
