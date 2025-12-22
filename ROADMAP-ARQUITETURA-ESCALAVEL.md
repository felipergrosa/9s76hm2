# 🚀 ROADMAP: Arquitetura Escalável para Milhares de Conversas Simultâneas

## 📊 Visão Geral

Este roadmap detalha a evolução do Whaticket de uma arquitetura monolítica para uma arquitetura distribuída, orientada a eventos e preparada para escalar horizontalmente.

**Meta:** Suportar **10.000+ conversas simultâneas** com alta disponibilidade, baixa latência e resiliência.

---

## 🎯 Fases de Desenvolvimento

### **FASE 1: FUNDAÇÃO E OTIMIZAÇÃO (4-6 semanas)**
Melhorar o monolito atual sem quebrar nada. Preparar terreno para desacoplamento.

### **FASE 2: DESACOPLAMENTO E EVENT BUS (6-8 semanas)**
Introduzir event bus, padronizar eventos, separar responsabilidades.

### **FASE 3: MICROSERVIÇOS E ESCALA HORIZONTAL (8-12 semanas)**
Separar agentes em serviços independentes, implementar orquestrador, escalar.

---

# FASE 1: FUNDAÇÃO E OTIMIZAÇÃO

## Objetivo
Otimizar o monolito atual, adicionar observabilidade, implementar locks e circuit breakers.

---

## 1.1 Observabilidade e Tracing

### ✅ **Task 1.1.1: Implementar Trace ID Global**

**Arquivos a criar:**
```
backend/src/middleware/traceId.ts
backend/src/utils/tracer.ts
backend/src/types/trace.d.ts
```

**Implementação:**

```typescript
// backend/src/middleware/traceId.ts
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  timestamp: Date;
}

declare global {
  namespace Express {
    interface Request {
      trace: TraceContext;
    }
  }
}

export const traceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const traceId = (req.headers['x-trace-id'] as string) || uuidv4();
  const spanId = uuidv4();
  
  req.trace = {
    traceId,
    spanId,
    timestamp: new Date()
  };
  
  res.setHeader('X-Trace-Id', traceId);
  next();
};
```

```typescript
// backend/src/utils/tracer.ts
import logger from './logger';

export class Tracer {
  static log(context: any, level: string, message: string, meta?: any) {
    logger[level]({
      trace_id: context.trace?.traceId || context.traceId,
      span_id: context.trace?.spanId || context.spanId,
      timestamp: new Date().toISOString(),
      message,
      ...meta
    });
  }

  static info(context: any, message: string, meta?: any) {
    this.log(context, 'info', message, meta);
  }

  static error(context: any, message: string, meta?: any) {
    this.log(context, 'error', message, meta);
  }

  static warn(context: any, message: string, meta?: any) {
    this.log(context, 'warn', message, meta);
  }
}
```

**Modificar:**
- `backend/src/app.ts`: adicionar `traceMiddleware` antes de todas as rotas
- Todos os services: adicionar `traceId` como parâmetro opcional

**Tempo estimado:** 3 dias

---

### ✅ **Task 1.1.2: Métricas de Performance**

**Arquivos a criar:**
```
backend/src/middleware/metrics.ts
backend/src/services/MetricsService.ts
backend/src/routes/metricsRoutes.ts
```

**Implementação:**

```typescript
// backend/src/middleware/metrics.ts
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from '../services/MetricsService';

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    MetricsService.recordHttpRequest({
      method: req.method,
      path: req.route?.path || req.path,
      statusCode: res.statusCode,
      duration,
      traceId: req.trace?.traceId
    });
  });
  
  next();
};
```

```typescript
// backend/src/services/MetricsService.ts
import Redis from 'ioredis';
import { getRedisClient } from '../libs/cache';

interface HttpMetric {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  traceId?: string;
}

export class MetricsService {
  private static redis: Redis;

  static async init() {
    this.redis = await getRedisClient();
  }

  static async recordHttpRequest(metric: HttpMetric) {
    const key = `metrics:http:${metric.method}:${metric.path}`;
    const timestamp = Date.now();
    
    await this.redis.zadd(key, timestamp, JSON.stringify(metric));
    await this.redis.expire(key, 86400); // 24h TTL
    
    // Incrementar contador
    await this.redis.hincrby('metrics:http:count', `${metric.method}:${metric.path}`, 1);
  }

  static async recordAIRequest(companyId: number, model: string, tokens: number, duration: number) {
    const key = `metrics:ai:${companyId}`;
    await this.redis.hincrby(key, 'total_requests', 1);
    await this.redis.hincrby(key, 'total_tokens', tokens);
    await this.redis.hincrby(key, 'total_duration_ms', duration);
    await this.redis.expire(key, 86400);
  }

  static async getMetrics(type: string, filter?: any) {
    // Implementar agregação de métricas
    const keys = await this.redis.keys(`metrics:${type}:*`);
    const metrics = [];
    
    for (const key of keys) {
      const data = await this.redis.zrange(key, 0, -1);
      metrics.push(...data.map(d => JSON.parse(d)));
    }
    
    return metrics;
  }
}
```

**Tempo estimado:** 4 dias

---

## 1.2 Locks e Concorrência

### ✅ **Task 1.2.1: Implementar Lock por Conversa**

**Arquivos a criar:**
```
backend/src/libs/conversationLock.ts
backend/src/middleware/conversationLock.ts
```

**Implementação:**

```typescript
// backend/src/libs/conversationLock.ts
import Redis from 'ioredis';
import { getRedisClient } from './cache';
import logger from '../utils/logger';

export class ConversationLock {
  private static redis: Redis;
  private static readonly LOCK_TTL = 30; // 30 segundos
  private static readonly RETRY_DELAY = 100; // 100ms
  private static readonly MAX_RETRIES = 50; // 5 segundos total

  static async init() {
    this.redis = await getRedisClient();
  }

  static async acquire(conversationId: string, workerId: string): Promise<boolean> {
    const key = `lock:conversation:${conversationId}`;
    
    for (let i = 0; i < this.MAX_RETRIES; i++) {
      const result = await this.redis.set(
        key,
        workerId,
        'EX',
        this.LOCK_TTL,
        'NX'
      );
      
      if (result === 'OK') {
        logger.info(`[ConversationLock] Lock acquired: ${conversationId} by ${workerId}`);
        return true;
      }
      
      // Esperar antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
    }
    
    logger.warn(`[ConversationLock] Failed to acquire lock: ${conversationId}`);
    return false;
  }

  static async release(conversationId: string, workerId: string): Promise<void> {
    const key = `lock:conversation:${conversationId}`;
    
    // Só libera se o lock pertence a este worker (atomic)
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    await this.redis.eval(script, 1, key, workerId);
    logger.info(`[ConversationLock] Lock released: ${conversationId} by ${workerId}`);
  }

  static async extend(conversationId: string, workerId: string): Promise<boolean> {
    const key = `lock:conversation:${conversationId}`;
    
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    
    const result = await this.redis.eval(script, 1, key, workerId, this.LOCK_TTL);
    return result === 1;
  }
}
```

**Modificar:**
- `backend/src/services/WbotServices/wbotMessageListener.ts`: adicionar lock antes de processar mensagem
- `backend/src/services/TicketServices/SendAIResponseService.ts`: adicionar lock antes de gerar resposta

**Tempo estimado:** 3 dias

---

### ✅ **Task 1.2.2: Deduplicação de Mensagens Aprimorada**

**Arquivos a criar:**
```
backend/src/services/MessageServices/MessageDeduplicationService.ts
```

**Implementação:**

```typescript
// backend/src/services/MessageServices/MessageDeduplicationService.ts
import Redis from 'ioredis';
import { getRedisClient } from '../../libs/cache';
import logger from '../../utils/logger';

export class MessageDeduplicationService {
  private static redis: Redis;
  private static readonly TTL = 3600; // 1 hora

  static async init() {
    this.redis = await getRedisClient();
  }

  static async isDuplicate(
    messageId: string,
    ticketId: number,
    body: string,
    timestamp: Date
  ): Promise<boolean> {
    const key = `dedup:msg:${ticketId}:${messageId}`;
    const exists = await this.redis.exists(key);
    
    if (exists) {
      logger.warn(`[MessageDedup] Duplicate detected: ${messageId} on ticket ${ticketId}`);
      return true;
    }
    
    // Marcar como processada
    await this.redis.setex(
      key,
      this.TTL,
      JSON.stringify({ body, timestamp, processedAt: new Date() })
    );
    
    return false;
  }

  static async markAsProcessed(messageId: string, ticketId: number): Promise<void> {
    const key = `dedup:msg:${ticketId}:${messageId}`;
    await this.redis.setex(key, this.TTL, JSON.stringify({ processedAt: new Date() }));
  }
}
```

**Tempo estimado:** 2 dias

---

## 1.3 Circuit Breaker e Resiliência

### ✅ **Task 1.3.1: Implementar Circuit Breaker**

**Arquivos a criar:**
```
backend/src/libs/circuitBreaker.ts
backend/src/services/IntegrationsServices/ResilientOpenAiService.ts
```

**Implementação:**

```typescript
// backend/src/libs/circuitBreaker.ts
import logger from '../utils/logger';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = Date.now();
  
  constructor(
    private name: string,
    private options: CircuitBreakerOptions
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
      this.state = CircuitState.HALF_OPEN;
      logger.info(`[CircuitBreaker] ${this.name} entering HALF_OPEN state`);
    }

    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.options.timeout)
        )
      ]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        logger.info(`[CircuitBreaker] ${this.name} is now CLOSED`);
      }
    }
  }

  private onFailure() {
    this.failureCount++;
    this.successCount = 0;

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.options.resetTimeout;
      logger.error(`[CircuitBreaker] ${this.name} is now OPEN until ${new Date(this.nextAttempt)}`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}
```

**Tempo estimado:** 3 dias

---

## 1.4 Otimização de Embeddings

### ✅ **Task 1.4.1: Fila de Embeddings Assíncrona**

**Arquivos a criar:**
```
backend/src/queues/EmbeddingQueue.ts
backend/src/jobs/ProcessEmbeddingJob.ts
```

**Implementação:**

```typescript
// backend/src/queues/EmbeddingQueue.ts
import Queue from 'bull';
import { getRedisClient } from '../libs/cache';

interface EmbeddingJob {
  documentId: number;
  text: string;
  companyId: number;
  type: 'knowledge' | 'message' | 'catalog';
}

export class EmbeddingQueue {
  private static queue: Queue.Queue<EmbeddingJob>;

  static async init() {
    const redis = await getRedisClient();
    
    this.queue = new Queue('embeddings', {
      redis: {
        host: redis.options.host,
        port: redis.options.port
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    });

    // Processar jobs
    this.queue.process(10, async (job) => {
      const { ProcessEmbeddingJob } = await import('../jobs/ProcessEmbeddingJob');
      return ProcessEmbeddingJob.execute(job.data);
    });
  }

  static async add(data: EmbeddingJob, priority?: number) {
    return this.queue.add(data, { priority });
  }

  static async addBatch(items: EmbeddingJob[]) {
    return this.queue.addBulk(
      items.map(data => ({ data, opts: { priority: 5 } }))
    );
  }
}
```

**Tempo estimado:** 4 dias

---

## 📊 Resumo Fase 1

| Task | Tempo | Prioridade |
|------|-------|------------|
| 1.1.1 Trace ID | 3 dias | Alta |
| 1.1.2 Métricas | 4 dias | Alta |
| 1.2.1 Locks | 3 dias | Crítica |
| 1.2.2 Deduplicação | 2 dias | Alta |
| 1.3.1 Circuit Breaker | 3 dias | Alta |
| 1.4.1 Fila Embeddings | 4 dias | Média |

**Total Fase 1:** 19 dias úteis (~4 semanas)

---

# FASE 2: DESACOPLAMENTO E EVENT BUS

## Objetivo
Introduzir event bus (Redis Streams), padronizar eventos, separar responsabilidades.

---

## 2.1 Event Bus com Redis Streams

### ✅ **Task 2.1.1: Implementar Event Bus**

**Arquivos a criar:**
```
backend/src/libs/eventBus.ts
backend/src/types/events.d.ts
backend/src/services/EventBusService.ts
```

**Implementação:**

```typescript
// backend/src/types/events.d.ts
export interface BaseEvent {
  event: string;
  event_id: string;
  trace_id: string;
  tenant_id: string;
  conversation_id: string;
  customer_id?: string;
  idempotency_key: string;
  timestamp: string;
  payload: any;
}

export interface MessageReceivedEvent extends BaseEvent {
  event: 'inbox.message.received';
  payload: {
    ticketId: number;
    messageId: string;
    contactId: number;
    body: string;
    mediaType: string;
    fromMe: boolean;
  };
}

export interface HandoffRequestedEvent extends BaseEvent {
  event: 'routing.handoff.requested';
  payload: {
    ticketId: number;
    fromAgent?: string;
    toAgent: string;
    reason: string;
    context: any;
  };
}

export interface AIResponseGeneratedEvent extends BaseEvent {
  event: 'agent.ai.response.generated';
  payload: {
    ticketId: number;
    agentId: number;
    response: string;
    tokensUsed: number;
    duration: number;
  };
}

export type WhaticketEvent = 
  | MessageReceivedEvent 
  | HandoffRequestedEvent 
  | AIResponseGeneratedEvent;
```

```typescript
// backend/src/libs/eventBus.ts
import Redis from 'ioredis';
import { getRedisClient } from './cache';
import { BaseEvent } from '../types/events';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class EventBus {
  private static redis: Redis;
  private static consumers: Map<string, Function[]> = new Map();

  static async init() {
    this.redis = await getRedisClient();
    logger.info('[EventBus] Initialized');
  }

  static async publish(streamName: string, event: Partial<BaseEvent>): Promise<string> {
    const fullEvent: BaseEvent = {
      event_id: uuidv4(),
      trace_id: event.trace_id || uuidv4(),
      timestamp: new Date().toISOString(),
      idempotency_key: event.idempotency_key || uuidv4(),
      ...event
    } as BaseEvent;

    const eventId = await this.redis.xadd(
      `stream:${streamName}`,
      '*',
      'data',
      JSON.stringify(fullEvent)
    );

    logger.info(`[EventBus] Published ${fullEvent.event} to ${streamName}`, {
      event_id: fullEvent.event_id,
      trace_id: fullEvent.trace_id
    });

    return eventId;
  }

  static async subscribe(
    streamName: string,
    consumerGroup: string,
    consumerName: string,
    handler: (event: BaseEvent) => Promise<void>
  ): Promise<void> {
    const stream = `stream:${streamName}`;

    // Criar consumer group se não existir
    try {
      await this.redis.xgroup('CREATE', stream, consumerGroup, '0', 'MKSTREAM');
    } catch (err: any) {
      if (!err.message.includes('BUSYGROUP')) {
        throw err;
      }
    }

    // Loop de consumo
    while (true) {
      try {
        const results = await this.redis.xreadgroup(
          'GROUP',
          consumerGroup,
          consumerName,
          'COUNT',
          10,
          'BLOCK',
          5000,
          'STREAMS',
          stream,
          '>'
        );

        if (!results) continue;

        for (const [, messages] of results) {
          for (const [messageId, fields] of messages) {
            const data = JSON.parse(fields[1]);
            
            try {
              await handler(data);
              await this.redis.xack(stream, consumerGroup, messageId);
            } catch (error) {
              logger.error(`[EventBus] Error processing event ${data.event_id}`, error);
              // Não fazer ACK, mensagem será reprocessada
            }
          }
        }
      } catch (error) {
        logger.error('[EventBus] Error in consumer loop', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
}
```

**Tempo estimado:** 5 dias

---

### ✅ **Task 2.1.2: Migrar wbotMessageListener para Event Bus**

**Modificar:**
```
backend/src/services/WbotServices/wbotMessageListener.ts
```

**Implementação:**

```typescript
// Substituir processamento direto por publicação de evento
import { EventBus } from '../../libs/eventBus';

// Antes:
// await handleMessage(msg, wbot);

// Depois:
await EventBus.publish('inbox.message.received', {
  event: 'inbox.message.received',
  tenant_id: String(companyId),
  conversation_id: `ticket:${ticket.id}`,
  customer_id: `contact:${contact.id}`,
  idempotency_key: msg.id.id,
  trace_id: req.trace?.traceId,
  payload: {
    ticketId: ticket.id,
    messageId: msg.id.id,
    contactId: contact.id,
    body: msg.body,
    mediaType: msg.type,
    fromMe: msg.fromMe
  }
});
```

**Criar consumer:**
```
backend/src/consumers/MessageReceivedConsumer.ts
```

**Tempo estimado:** 6 dias

---

## 2.2 Orquestrador (Dispatcher)

### ✅ **Task 2.2.1: Implementar Dispatcher Service**

**Arquivos a criar:**
```
backend/src/services/DispatcherService.ts
backend/src/consumers/DispatcherConsumer.ts
```

**Implementação:**

```typescript
// backend/src/services/DispatcherService.ts
import { MessageReceivedEvent, HandoffRequestedEvent } from '../types/events';
import { EventBus } from '../libs/eventBus';
import { ConversationLock } from '../libs/conversationLock';
import { MessageDeduplicationService } from './MessageServices/MessageDeduplicationService';
import Ticket from '../models/Ticket';
import logger from '../utils/logger';

export class DispatcherService {
  static async dispatch(event: MessageReceivedEvent): Promise<void> {
    const { payload, trace_id, idempotency_key, conversation_id } = event;

    // 1. Deduplicação
    const isDuplicate = await MessageDeduplicationService.isDuplicate(
      payload.messageId,
      payload.ticketId,
      payload.body,
      new Date()
    );

    if (isDuplicate) {
      logger.warn(`[Dispatcher] Duplicate message ${payload.messageId}, skipping`);
      return;
    }

    // 2. Lock por conversa
    const workerId = `dispatcher:${process.pid}`;
    const locked = await ConversationLock.acquire(conversation_id, workerId);

    if (!locked) {
      logger.warn(`[Dispatcher] Could not acquire lock for ${conversation_id}`);
      throw new Error('Lock acquisition failed');
    }

    try {
      // 3. Buscar ticket e determinar agente
      const ticket = await Ticket.findByPk(payload.ticketId);
      
      if (!ticket) {
        throw new Error(`Ticket ${payload.ticketId} not found`);
      }

      // 4. Classificar intenção e rotear
      const agent = await this.classifyAndRoute(ticket, payload);

      // 5. Emitir evento de handoff
      await EventBus.publish('routing.handoff.requested', {
        event: 'routing.handoff.requested',
        tenant_id: event.tenant_id,
        conversation_id,
        trace_id,
        idempotency_key: `handoff:${idempotency_key}`,
        payload: {
          ticketId: ticket.id,
          toAgent: agent,
          reason: 'message_received',
          context: { originalEvent: event }
        }
      });

    } finally {
      await ConversationLock.release(conversation_id, workerId);
    }
  }

  private static async classifyAndRoute(ticket: any, payload: any): Promise<string> {
    // Lógica de classificação
    if (ticket.status === 'bot') return 'agent.ai';
    if (ticket.queueId) return `agent.queue.${ticket.queueId}`;
    return 'agent.triage';
  }
}
```

**Tempo estimado:** 7 dias

---

## 📊 Resumo Fase 2

| Task | Tempo | Prioridade |
|------|-------|------------|
| 2.1.1 Event Bus | 5 dias | Crítica |
| 2.1.2 Migrar Listener | 6 dias | Crítica |
| 2.2.1 Dispatcher | 7 dias | Alta |

**Total Fase 2:** 18 dias úteis (~4 semanas)

---

# FASE 3: MICROSERVIÇOS E ESCALA HORIZONTAL

## Objetivo
Separar agentes em serviços independentes, implementar orquestrador robusto, escalar horizontalmente.

---

## 3.1 Separação de Agentes

### ✅ **Task 3.1.1: Agente IA como Microserviço**

**Criar novo projeto:**
```
services/
  ai-agent/
    src/
      index.ts
      AgentService.ts
      consumers/
        AIHandoffConsumer.ts
    package.json
    Dockerfile
```

**Implementação:**

```typescript
// services/ai-agent/src/AgentService.ts
import { EventBus } from './libs/eventBus';
import { HandoffRequestedEvent } from './types/events';
import { OpenAI } from 'openai';

export class AIAgentService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async handleHandoff(event: HandoffRequestedEvent): Promise<void> {
    const { payload, trace_id } = event;

    // Buscar contexto
    const context = await this.fetchContext(payload.ticketId);

    // Gerar resposta
    const response = await this.generateResponse(context);

    // Publicar evento de resposta
    await EventBus.publish('agent.ai.response.generated', {
      event: 'agent.ai.response.generated',
      tenant_id: event.tenant_id,
      conversation_id: event.conversation_id,
      trace_id,
      payload: {
        ticketId: payload.ticketId,
        response: response.text,
        tokensUsed: response.tokens,
        duration: response.duration
      }
    });
  }

  private async fetchContext(ticketId: number): Promise<any> {
    // Buscar do Memory Manager
  }

  private async generateResponse(context: any): Promise<any> {
    // Gerar com OpenAI
  }
}
```

**Tempo estimado:** 10 dias

---

## 3.2 Tool Gateway

### ✅ **Task 3.2.1: Tool Gateway como API Separada**

**Criar novo projeto:**
```
services/
  tool-gateway/
    src/
      index.ts
      ToolGatewayService.ts
      tools/
        ERPTool.ts
        CRMTool.ts
        CatalogTool.ts
    package.json
    Dockerfile
```

**Tempo estimado:** 12 dias

---

## 3.3 Kubernetes e Orquestração

### ✅ **Task 3.3.1: Configurar Kubernetes**

**Arquivos a criar:**
```
k8s/
  namespace.yaml
  configmap.yaml
  secrets.yaml
  deployments/
    backend.yaml
    ai-agent.yaml
    tool-gateway.yaml
  services/
    backend-service.yaml
    ai-agent-service.yaml
  ingress.yaml
  hpa.yaml (Horizontal Pod Autoscaler)
```

**Tempo estimado:** 8 dias

---

## 📊 Resumo Fase 3

| Task | Tempo | Prioridade |
|------|-------|------------|
| 3.1.1 Agente IA Microserviço | 10 dias | Alta |
| 3.2.1 Tool Gateway | 12 dias | Alta |
| 3.3.1 Kubernetes | 8 dias | Média |

**Total Fase 3:** 30 dias úteis (~6 semanas)

---

# 📈 TIMELINE COMPLETO

```
┌─────────────────────────────────────────────────────────────────┐
│                    ROADMAP COMPLETO                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FASE 1: FUNDAÇÃO (4 semanas)                                  │
│  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░         │
│                                                                 │
│  FASE 2: DESACOPLAMENTO (4 semanas)                            │
│  ░░░░░░░░░░░░████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░         │
│                                                                 │
│  FASE 3: MICROSERVIÇOS (6 semanas)                             │
│  ░░░░░░░░░░░░░░░░░░░░░░░░████████████████████░░░░░░░░         │
│                                                                 │
│  TOTAL: 14 semanas (~3.5 meses)                                │
└─────────────────────────────────────────────────────────────────┘
```

---

# 🎯 MÉTRICAS DE SUCESSO

## Fase 1
- ✅ 100% das requisições com `trace_id`
- ✅ Locks funcionando sem race conditions
- ✅ Circuit breaker reduz falhas em 80%
- ✅ Embeddings processados em fila (não bloqueiam)

## Fase 2
- ✅ 100% das mensagens passam pelo event bus
- ✅ Dispatcher processa 1000+ eventos/segundo
- ✅ Zero duplicação de mensagens

## Fase 3
- ✅ Agentes escalam independentemente
- ✅ Suporta 10.000+ conversas simultâneas
- ✅ Latência P95 < 500ms
- ✅ 99.9% uptime

---

# 🚀 PRÓXIMOS PASSOS

1. **Revisar este roadmap** com a equipe
2. **Priorizar tasks** baseado em necessidades imediatas
3. **Começar pela Fase 1** (fundação sólida)
4. **Monitorar métricas** a cada sprint
5. **Ajustar conforme necessário**

---

**Documento criado em:** 22/12/2025  
**Versão:** 1.0  
**Autor:** Cascade AI
