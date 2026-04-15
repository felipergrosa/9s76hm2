/**
 * AIObservabilityService.ts
 * 
 * Sistema de observabilidade para IA com:
 * - Logs estruturados (JSON)
 * - Métricas Prometheus
 * - Tracing distribuído (OpenTelemetry)
 * - Dashboard de métricas
 */

import logger from "../../utils/logger";

// Tipos de eventos de IA
export type AIEventType = 
  | "request_start"
  | "request_end"
  | "rag_search"
  | "llm_call"
  | "function_call"
  | "fallback"
  | "error"
  | "cache_hit"
  | "cache_miss"
  | "token_usage"
  | "latency";

export interface AILogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  event: AIEventType;
  companyId?: number;
  agentId?: number;
  ticketId?: number;
  contactId?: number;
  sessionId?: string;
  provider?: string;
  model?: string;
  duration?: number;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost?: number;
  cacheHit?: boolean;
  error?: string;
  functionName?: string;
  functionArgs?: any;
  functionResult?: any;
  metadata?: Record<string, any>;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
}

// Métricas em memória (para Prometheus scraping)
interface AIMetrics {
  requestsTotal: Map<string, number>;
  requestsDuration: Map<string, number[]>;
  tokensTotal: Map<string, number>;
  costTotal: Map<string, number>;
  cacheHits: Map<string, number>;
  cacheMisses: Map<string, number>;
  errors: Map<string, number>;
  functionCalls: Map<string, number>;
  fallbackTriggers: Map<string, number>;
}

class AIObservabilityService {
  private metrics: AIMetrics = {
    requestsTotal: new Map(),
    requestsDuration: new Map(),
    tokensTotal: new Map(),
    costTotal: new Map(),
    cacheHits: new Map(),
    cacheMisses: new Map(),
    errors: new Map(),
    functionCalls: new Map(),
    fallbackTriggers: new Map()
  };

  private spans: Map<string, any> = new Map();
  private traceCounter = 0;

  /**
   * Gerar trace ID
   */
  private generateTraceId(): string {
    return `ai-${Date.now()}-${++this.traceCounter}`;
  }

  private generateSpanId(): string {
    return `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Iniciar trace
   */
  startTrace(ticketId?: number, contactId?: number): { traceId: string; spanId: string } {
    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();

    this.spans.set(traceId, {
      traceId,
      rootSpanId: spanId,
      startTime: Date.now(),
      ticketId,
      contactId,
      spans: new Map()
    });

    return { traceId, spanId };
  }

  /**
   * Iniciar span
   */
  startSpan(traceId: string, name: string, parentSpanId?: string): string {
    const spanId = this.generateSpanId();
    const trace = this.spans.get(traceId);

    if (trace) {
      trace.spans.set(spanId, {
        spanId,
        parentSpanId,
        name,
        startTime: Date.now(),
        tags: {}
      });
    }

    return spanId;
  }

  /**
   * Finalizar span
   */
  endSpan(traceId: string, spanId: string, tags?: Record<string, any>): void {
    const trace = this.spans.get(traceId);
    if (!trace) return;

    const span = trace.spans.get(spanId);
    if (span) {
      span.endTime = Date.now();
      span.duration = span.endTime - span.startTime;
      span.tags = { ...span.tags, ...tags };
    }
  }

  /**
   * Finalizar trace
   */
  endTrace(traceId: string, metadata?: Record<string, any>): void {
    const trace = this.spans.get(traceId);
    if (!trace) return;

    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.metadata = metadata;

    // Log trace completo
    this.logStructured({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "request_end",
      traceId,
      duration: trace.duration,
      metadata: {
        spans: Array.from(trace.spans.values()),
        ...metadata
      }
    });

    // Cleanup após 5 minutos
    setTimeout(() => {
      this.spans.delete(traceId);
    }, 300000);
  }

  /**
   * Log estruturado JSON
   */
  logStructured(entry: AILogEntry): void {
    // Log JSON formatado
    const jsonLog = JSON.stringify({
      ...entry,
      service: "ai-orchestrator",
      version: process.env.BACKEND_VERSION || "1.0.0"
    });

    // Log via logger padrão também
    switch (entry.level) {
      case "error":
        logger.error(`[AI] ${entry.event}: ${entry.error || ""}`, jsonLog);
        break;
      case "warn":
        logger.warn(`[AI] ${entry.event}`, jsonLog);
        break;
      case "debug":
        logger.debug(`[AI] ${entry.event}`, jsonLog);
        break;
      default:
        logger.info(`[AI] ${entry.event}`, jsonLog);
    }

    // Atualizar métricas
    this.updateMetrics(entry);
  }

  /**
   * Atualizar métricas internas
   */
  private updateMetrics(entry: AILogEntry): void {
    const key = `${entry.companyId || "global"}`;

    // Requests total
    if (entry.event === "request_start") {
      this.metrics.requestsTotal.set(
        key,
        (this.metrics.requestsTotal.get(key) || 0) + 1
      );
    }

    // Duration
    if (entry.duration) {
      const durations = this.metrics.requestsDuration.get(key) || [];
      durations.push(entry.duration);
      // Manter apenas últimos 1000
      if (durations.length > 1000) durations.shift();
      this.metrics.requestsDuration.set(key, durations);
    }

    // Tokens
    if (entry.tokens?.total) {
      this.metrics.tokensTotal.set(
        key,
        (this.metrics.tokensTotal.get(key) || 0) + entry.tokens.total
      );
    }

    // Cost
    if (entry.cost) {
      this.metrics.costTotal.set(
        key,
        (this.metrics.costTotal.get(key) || 0) + entry.cost
      );
    }

    // Cache
    if (entry.cacheHit !== undefined) {
      if (entry.cacheHit) {
        this.metrics.cacheHits.set(key, (this.metrics.cacheHits.get(key) || 0) + 1);
      } else {
        this.metrics.cacheMisses.set(key, (this.metrics.cacheMisses.get(key) || 0) + 1);
      }
    }

    // Errors
    if (entry.level === "error") {
      this.metrics.errors.set(key, (this.metrics.errors.get(key) || 0) + 1);
    }

    // Function calls
    if (entry.event === "function_call") {
      this.metrics.functionCalls.set(
        `${key}:${entry.functionName}`,
        (this.metrics.functionCalls.get(`${key}:${entry.functionName}`) || 0) + 1
      );
    }

    // Fallbacks
    if (entry.event === "fallback") {
      this.metrics.fallbackTriggers.set(key, (this.metrics.fallbackTriggers.get(key) || 0) + 1);
    }
  }

  /**
   * Métricas para Prometheus
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];
    const timestamp = Date.now();

    // Requests total
    lines.push("# HELP ai_requests_total Total AI requests");
    lines.push("# TYPE ai_requests_total counter");
    for (const [key, value] of this.metrics.requestsTotal) {
      lines.push(`ai_requests_total{company="${key}"} ${value} ${timestamp}`);
    }

    // Duration (p95)
    lines.push("# HELP ai_request_duration_seconds AI request duration");
    lines.push("# TYPE ai_request_duration_seconds histogram");
    for (const [key, durations] of this.metrics.requestsDuration) {
      if (durations.length > 0) {
        const sorted = [...durations].sort((a, b) => a - b);
        const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
        lines.push(`ai_request_duration_p95{company="${key}"} ${p95 / 1000} ${timestamp}`);
      }
    }

    // Tokens
    lines.push("# HELP ai_tokens_total Total tokens used");
    lines.push("# TYPE ai_tokens_total counter");
    for (const [key, value] of this.metrics.tokensTotal) {
      lines.push(`ai_tokens_total{company="${key}"} ${value} ${timestamp}`);
    }

    // Cost
    lines.push("# HELP ai_cost_usd_total Total AI cost in USD");
    lines.push("# TYPE ai_cost_usd_total counter");
    for (const [key, value] of this.metrics.costTotal) {
      lines.push(`ai_cost_usd_total{company="${key}"} ${value.toFixed(4)} ${timestamp}`);
    }

    // Cache hit rate
    lines.push("# HELP ai_cache_hits_total Cache hits");
    lines.push("# TYPE ai_cache_hits_total counter");
    for (const [key, value] of this.metrics.cacheHits) {
      lines.push(`ai_cache_hits_total{company="${key}"} ${value} ${timestamp}`);
    }

    lines.push("# HELP ai_cache_misses_total Cache misses");
    lines.push("# TYPE ai_cache_misses_total counter");
    for (const [key, value] of this.metrics.cacheMisses) {
      lines.push(`ai_cache_misses_total{company="${key}"} ${value} ${timestamp}`);
    }

    // Errors
    lines.push("# HELP ai_errors_total Total AI errors");
    lines.push("# TYPE ai_errors_total counter");
    for (const [key, value] of this.metrics.errors) {
      lines.push(`ai_errors_total{company="${key}"} ${value} ${timestamp}`);
    }

    return lines.join("\n");
  }

  /**
   * Estatísticas resumidas
   */
  getStats(companyId?: number): any {
    const key = companyId ? `${companyId}` : "global";

    const durations = this.metrics.requestsDuration.get(key) || [];
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const hits = this.metrics.cacheHits.get(key) || 0;
    const misses = this.metrics.cacheMisses.get(key) || 0;
    const totalCache = hits + misses;

    return {
      requests: {
        total: this.metrics.requestsTotal.get(key) || 0,
        avgDuration: Math.round(avgDuration),
        p95: this.calculateP95(durations)
      },
      tokens: {
        total: this.metrics.tokensTotal.get(key) || 0
      },
      cost: {
        total: (this.metrics.costTotal.get(key) || 0).toFixed(4)
      },
      cache: {
        hits,
        misses,
        hitRate: totalCache > 0 ? ((hits / totalCache) * 100).toFixed(2) : 0
      },
      errors: this.metrics.errors.get(key) || 0,
      fallbackTriggers: this.metrics.fallbackTriggers.get(key) || 0,
      functionCalls: Array.from(this.metrics.functionCalls.entries())
        .filter(([k]) => k.startsWith(`${key}:`))
        .map(([k, v]) => ({ function: k.split(":")[1], count: v }))
    };
  }

  private calculateP95(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
  }

  /**
   * Limpar métricas antigas (chamar periodicamente)
   */
  cleanup(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 horas

    // Limpar spans antigos
    for (const [traceId, trace] of this.spans) {
      if (trace.startTime < cutoff) {
        this.spans.delete(traceId);
      }
    }
  }
}

// Singleton
export const aiObservability = new AIObservabilityService();
export default aiObservability;
