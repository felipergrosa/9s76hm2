/**
 * AIRateLimitService.ts
 * 
 * Sistema de Rate Limiting Inteligente para IA
 * - Limites por empresa, usuário, IP
 * - Quotas mensais
 * - Circuit breaker por provider
 * - Throttling adaptativo
 */

import NodeCache from "node-cache";
import logger from "../../utils/logger";

interface RateLimitConfig {
  // Por empresa
  maxTokensPerMinute: number;
  maxTokensPerHour: number;
  maxTokensPerDay: number;
  monthlyBudgetUsd: number;
  
  // Por usuário
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  
  // Por IP
  maxRequestsPerMinutePerIp: number;
  
  // Cost
  costPer1kTokens: number;
  
  // Circuit breaker
  errorThreshold: number;
  backoffMinutes: number;
}

interface RateLimitState {
  tokensUsed: {
    minute: number;
    hour: number;
    day: number;
    month: number;
  };
  costUsed: {
    month: number;
  };
  requestsCount: {
    minute: number;
    hour: number;
  };
  lastRequest: number;
  errorCount: number;
  backoffUntil?: number;
}

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  remainingTokens?: number;
  remainingRequests?: number;
  resetTime?: Date;
  throttled?: boolean;
  throttleDelay?: number;
}

class AIRateLimitService {
  private state: NodeCache;
  private configs: Map<number, RateLimitConfig> = new Map();

  // Config padrão
  private defaultConfig: RateLimitConfig = {
    maxTokensPerMinute: 10000,
    maxTokensPerHour: 50000,
    maxTokensPerDay: 200000,
    monthlyBudgetUsd: 500,
    maxRequestsPerMinute: 60,
    maxRequestsPerHour: 500,
    maxRequestsPerMinutePerIp: 30,
    costPer1kTokens: 0.002,
    errorThreshold: 5,
    backoffMinutes: 15
  };

  constructor() {
    // Cache com TTL de 1 minuto para estados
    this.state = new NodeCache({ stdTTL: 60, checkperiod: 30 });
  }

  /**
   * Configurar limites para empresa
   */
  configure(companyId: number, config: Partial<RateLimitConfig>): void {
    const existing = this.configs.get(companyId) || this.defaultConfig;
    this.configs.set(companyId, { ...existing, ...config });
    logger.info(`[RateLimit] Configurado para empresa ${companyId}`);
  }

  /**
   * Verificar rate limit
   */
  async checkLimit(
    companyId: number,
    userId: number,
    ip?: string,
    estimatedTokens: number = 1000
  ): Promise<RateLimitResult> {
    const config = this.configs.get(companyId) || this.defaultConfig;
    const now = Date.now();
    const state = this.getState(companyId);

    // Verificar circuit breaker
    if (state.backoffUntil && now < state.backoffUntil) {
      return {
        allowed: false,
        reason: `Circuit breaker ativo até ${new Date(state.backoffUntil).toISOString()}`,
        resetTime: new Date(state.backoffUntil)
      };
    }

    // Resetar backoff se passou
    if (state.backoffUntil && now >= state.backoffUntil) {
      state.errorCount = 0;
      state.backoffUntil = undefined;
    }

    // Verificar tokens por tempo
    const estimatedCost = (estimatedTokens / 1000) * config.costPer1kTokens;

    if (state.tokensUsed.minute + estimatedTokens > config.maxTokensPerMinute) {
      return {
        allowed: false,
        reason: "Limite de tokens por minuto excedido",
        remainingTokens: config.maxTokensPerMinute - state.tokensUsed.minute,
        resetTime: new Date(now + 60000)
      };
    }

    if (state.tokensUsed.hour + estimatedTokens > config.maxTokensPerHour) {
      return {
        allowed: false,
        reason: "Limite de tokens por hora excedido",
        resetTime: new Date(now + 3600000)
      };
    }

    if (state.tokensUsed.day + estimatedTokens > config.maxTokensPerDay) {
      return {
        allowed: false,
        reason: "Limite de tokens por dia excedido",
        resetTime: new Date(now + 86400000)
      };
    }

    // Verificar budget mensal
    if (state.costUsed.month + estimatedCost > config.monthlyBudgetUsd) {
      return {
        allowed: false,
        reason: `Orçamento mensal de $${config.monthlyBudgetUsd} excedido`,
        resetTime: new Date(now + 30 * 86400000)
      };
    }

    // Verificar requests por usuário
    const userKey = `user:${companyId}:${userId}`;
    const userRequests = this.state.get<{ minute: number; hour: number; lastReset: number }>(userKey);

    if (userRequests) {
      if (userRequests.minute >= config.maxRequestsPerMinute) {
        return {
          allowed: false,
          reason: "Limite de requisições por minuto excedido",
          remainingRequests: 0,
          resetTime: new Date(now + 60000)
        };
      }
    }

    // Verificar IP
    if (ip) {
      const ipKey = `ip:${ip}`;
      const ipRequests = this.state.get<number>(ipKey) || 0;
      
      if (ipRequests >= config.maxRequestsPerMinutePerIp) {
        return {
          allowed: false,
          reason: "Limite de requisições por IP excedido",
          resetTime: new Date(now + 60000)
        };
      }
    }

    // Calcular throttling adaptativo
    const throttleDelay = this.calculateThrottleDelay(state, config);

    return {
      allowed: true,
      remainingTokens: config.maxTokensPerMinute - state.tokensUsed.minute,
      remainingRequests: config.maxRequestsPerMinute - (userRequests?.minute || 0),
      throttled: throttleDelay > 0,
      throttleDelay
    };
  }

  /**
   * Registrar uso
   */
  async recordUsage(
    companyId: number,
    userId: number,
    tokens: number,
    ip?: string
  ): Promise<void> {
    const config = this.configs.get(companyId) || this.defaultConfig;
    const state = this.getState(companyId);
    const cost = (tokens / 1000) * config.costPer1kTokens;

    // Atualizar estado da empresa
    state.tokensUsed.minute += tokens;
    state.tokensUsed.hour += tokens;
    state.tokensUsed.day += tokens;
    state.tokensUsed.month += tokens;
    state.costUsed.month += cost;
    state.lastRequest = Date.now();

    this.setState(companyId, state);

    // Atualizar contador do usuário
    const userKey = `user:${companyId}:${userId}`;
    const userRequests = this.state.get<{ minute: number; hour: number }>(userKey) || { minute: 0, hour: 0 };
    userRequests.minute++;
    userRequests.hour++;
    this.state.set(userKey, userRequests, 60); // TTL 1 minuto

    // Atualizar IP
    if (ip) {
      const ipKey = `ip:${ip}`;
      const ipCount = (this.state.get<number>(ipKey) || 0) + 1;
      this.state.set(ipKey, ipCount, 60);
    }

    // Log se aproximando limites
    const minutePercent = (state.tokensUsed.minute / config.maxTokensPerMinute) * 100;
    if (minutePercent > 80) {
      logger.warn(`[RateLimit] Empresa ${companyId} atingiu ${minutePercent.toFixed(1)}% do limite por minuto`);
    }
  }

  /**
   * Registrar erro (para circuit breaker)
   */
  async recordError(companyId: number, errorType?: string): Promise<void> {
    const state = this.getState(companyId);
    state.errorCount++;

    const config = this.configs.get(companyId) || this.defaultConfig;

    // Ativar circuit breaker se muitos erros
    if (state.errorCount >= config.errorThreshold) {
      state.backoffUntil = Date.now() + config.backoffMinutes * 60000;
      logger.error(`[RateLimit] Circuit breaker ativado para empresa ${companyId} por ${config.backoffMinutes}min`);
    }

    this.setState(companyId, state);
  }

  /**
   * Calcular delay de throttling adaptativo
   */
  private calculateThrottleDelay(state: RateLimitState, config: RateLimitConfig): number {
    const minutePercent = state.tokensUsed.minute / config.maxTokensPerMinute;
    
    // Se usou mais de 50%, começar a throttling
    if (minutePercent < 0.5) return 0;
    
    // Delay progressivo: 0ms -> 100ms -> 500ms -> 1000ms
    if (minutePercent < 0.7) return 100;
    if (minutePercent < 0.85) return 500;
    return 1000;
  }

  /**
   * Obter estado
   */
  private getState(companyId: number): RateLimitState {
    const key = `company:${companyId}`;
    return this.state.get<RateLimitState>(key) || {
      tokensUsed: { minute: 0, hour: 0, day: 0, month: 0 },
      costUsed: { month: 0 },
      requestsCount: { minute: 0, hour: 0 },
      lastRequest: 0,
      errorCount: 0
    };
  }

  /**
   * Salvar estado
   */
  private setState(companyId: number, state: RateLimitState): void {
    const key = `company:${companyId}`;
    this.state.set(key, state, 3600); // TTL 1 hora
  }

  /**
   * Obter estatísticas
   */
  getStats(companyId: number): any {
    const state = this.getState(companyId);
    const config = this.configs.get(companyId) || this.defaultConfig;

    return {
      tokensUsed: state.tokensUsed,
      costUsed: state.costUsed,
      budgetRemaining: config.monthlyBudgetUsd - state.costUsed.month,
      errorCount: state.errorCount,
      backoffActive: state.backoffUntil ? state.backoffUntil > Date.now() : false,
      backoffUntil: state.backoffUntil,
      limits: {
        maxTokensPerMinute: config.maxTokensPerMinute,
        maxTokensPerHour: config.maxTokensPerHour,
        maxTokensPerDay: config.maxTokensPerDay,
        monthlyBudget: config.monthlyBudgetUsd
      }
    };
  }

  /**
   * Resetar estatísticas (para testes ou novo mês)
   */
  reset(companyId: number, scope: "minute" | "hour" | "day" | "month" | "all"): void {
    const state = this.getState(companyId);

    if (scope === "all") {
      this.state.del(`company:${companyId}`);
    } else {
      state.tokensUsed[scope] = 0;
      if (scope === "month") {
        state.costUsed.month = 0;
      }
      this.setState(companyId, state);
    }

    logger.info(`[RateLimit] Reset ${scope} para empresa ${companyId}`);
  }

  /**
   * Limpeza periódica
   */
  cleanup(): void {
    // O NodeCache já gerencia TTL automaticamente
    logger.debug("[RateLimit] Cleanup executado (TTL automático)");
  }
}

// Singleton
export const aiRateLimit = new AIRateLimitService();
export default aiRateLimit;
