# 🗺️ CODEMAP: Estrutura de Arquitetura Escalável

## 📁 Estrutura de Diretórios Completa

```
whaticket/
├── backend/                                    # Backend monolítico (Fase 1 e 2)
│   ├── src/
│   │   ├── app.ts                             # [MODIFICAR] Adicionar traceMiddleware, metricsMiddleware
│   │   ├── server.ts                          # [MODIFICAR] Inicializar EventBus, ConversationLock
│   │   │
│   │   ├── middleware/                        # [CRIAR] Middlewares novos
│   │   │   ├── traceId.ts                    # ✅ Fase 1.1.1 - Trace ID em todas requisições
│   │   │   ├── metrics.ts                    # ✅ Fase 1.1.2 - Coleta de métricas HTTP
│   │   │   └── conversationLock.ts           # ✅ Fase 1.2.1 - Lock automático por conversa
│   │   │
│   │   ├── libs/                              # [EXPANDIR] Bibliotecas core
│   │   │   ├── socket.ts                     # [EXISTENTE] Socket.IO com Redis adapter
│   │   │   ├── cache.ts                      # [EXISTENTE] Redis client
│   │   │   ├── eventBus.ts                   # ✅ Fase 2.1.1 - Event Bus com Redis Streams
│   │   │   ├── conversationLock.ts           # ✅ Fase 1.2.1 - Sistema de locks distribuídos
│   │   │   ├── circuitBreaker.ts             # ✅ Fase 1.3.1 - Circuit breaker pattern
│   │   │   └── queue.ts                      # [EXISTENTE] BullMQ
│   │   │
│   │   ├── utils/                             # [EXPANDIR] Utilitários
│   │   │   ├── logger.ts                     # [EXISTENTE] Winston logger
│   │   │   ├── tracer.ts                     # ✅ Fase 1.1.1 - Trace logging helper
│   │   │   └── validators.ts                 # [EXISTENTE] Validações
│   │   │
│   │   ├── types/                             # [CRIAR] Definições de tipos
│   │   │   ├── trace.d.ts                    # ✅ Fase 1.1.1 - Tipos de tracing
│   │   │   ├── events.d.ts                   # ✅ Fase 2.1.1 - Schema de eventos
│   │   │   └── metrics.d.ts                  # ✅ Fase 1.1.2 - Tipos de métricas
│   │   │
│   │   ├── services/
│   │   │   ├── MetricsService.ts             # ✅ Fase 1.1.2 - Agregação de métricas
│   │   │   ├── EventBusService.ts            # ✅ Fase 2.1.1 - Gerenciamento de eventos
│   │   │   ├── DispatcherService.ts          # ✅ Fase 2.2.1 - Orquestrador central
│   │   │   │
│   │   │   ├── MessageServices/
│   │   │   │   ├── MessageDeduplicationService.ts  # ✅ Fase 1.2.2 - Dedup aprimorado
│   │   │   │   └── ListMessagesService.ts    # [EXISTENTE]
│   │   │   │
│   │   │   ├── TicketServices/
│   │   │   │   ├── SendAIResponseService.ts  # [MODIFICAR] Adicionar circuit breaker
│   │   │   │   └── BulkProcessTicketsService.ts  # [EXISTENTE]
│   │   │   │
│   │   │   ├── IntegrationsServices/
│   │   │   │   ├── OpenAiService.ts          # [EXISTENTE]
│   │   │   │   └── ResilientOpenAiService.ts # ✅ Fase 1.3.1 - Com circuit breaker
│   │   │   │
│   │   │   ├── WbotServices/
│   │   │   │   └── wbotMessageListener.ts    # [MODIFICAR] Publicar eventos no bus
│   │   │   │
│   │   │   └── RAG/
│   │   │       ├── EmbeddingService.ts       # [MODIFICAR] Usar fila assíncrona
│   │   │       ├── RAGIndexService.ts        # [EXISTENTE]
│   │   │       └── RAGSearchService.ts       # [EXISTENTE]
│   │   │
│   │   ├── consumers/                         # [CRIAR] Event consumers
│   │   │   ├── MessageReceivedConsumer.ts    # ✅ Fase 2.1.2 - Processa inbox.message.received
│   │   │   ├── DispatcherConsumer.ts         # ✅ Fase 2.2.1 - Processa routing.handoff.requested
│   │   │   ├── AIAgentConsumer.ts            # ✅ Fase 2.2.1 - Processa agent.ai.*
│   │   │   └── ToolExecutionConsumer.ts      # ✅ Fase 2.2.1 - Processa tools.call.*
│   │   │
│   │   ├── queues/                            # [EXPANDIR] Filas BullMQ
│   │   │   ├── EmbeddingQueue.ts             # ✅ Fase 1.4.1 - Fila de embeddings
│   │   │   ├── ImportContactsQueue.ts        # [EXISTENTE]
│   │   │   └── userMonitor.ts                # [EXISTENTE]
│   │   │
│   │   ├── jobs/                              # [EXPANDIR] Job processors
│   │   │   ├── ProcessEmbeddingJob.ts        # ✅ Fase 1.4.1 - Processar embeddings
│   │   │   └── VerifyInactivityTimeoutJob.ts # [EXISTENTE]
│   │   │
│   │   ├── routes/
│   │   │   ├── metricsRoutes.ts              # ✅ Fase 1.1.2 - API de métricas
│   │   │   ├── healthRoutes.ts               # ✅ Fase 1.1.2 - Health checks
│   │   │   └── index.ts                      # [MODIFICAR] Adicionar novas rotas
│   │   │
│   │   └── controllers/
│   │       ├── MetricsController.ts          # ✅ Fase 1.1.2 - Expor métricas
│   │       └── HealthController.ts           # ✅ Fase 1.1.2 - Health endpoints
│   │
│   ├── package.json                           # [MODIFICAR] Adicionar dependências
│   └── Dockerfile                             # [MODIFICAR] Otimizar para produção
│
├── services/                                   # [CRIAR] Microserviços (Fase 3)
│   │
│   ├── ai-agent/                              # ✅ Fase 3.1.1 - Agente IA isolado
│   │   ├── src/
│   │   │   ├── index.ts                      # Entry point
│   │   │   ├── AgentService.ts               # Lógica do agente
│   │   │   ├── ContextManager.ts             # Gerenciamento de contexto
│   │   │   ├── ResponseGenerator.ts          # Geração de respostas
│   │   │   │
│   │   │   ├── consumers/
│   │   │   │   └── AIHandoffConsumer.ts      # Consome agent.ai.handoff
│   │   │   │
│   │   │   ├── libs/
│   │   │   │   ├── eventBus.ts               # Cliente do event bus
│   │   │   │   └── memoryClient.ts           # Cliente do Memory Manager
│   │   │   │
│   │   │   └── config/
│   │   │       └── index.ts                  # Configurações
│   │   │
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   └── k8s/
│   │       ├── deployment.yaml
│   │       ├── service.yaml
│   │       └── hpa.yaml
│   │
│   ├── tool-gateway/                          # ✅ Fase 3.2.1 - Gateway de tools
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── ToolGatewayService.ts
│   │   │   ├── ToolRegistry.ts               # Registro de tools disponíveis
│   │   │   ├── RBACManager.ts                # Controle de acesso por agente
│   │   │   │
│   │   │   ├── tools/                        # Tools implementadas
│   │   │   │   ├── ERPTool.ts               # Integração ERP
│   │   │   │   ├── CRMTool.ts               # Integração CRM
│   │   │   │   ├── CatalogTool.ts           # Busca em catálogo
│   │   │   │   ├── EmailTool.ts             # Envio de emails
│   │   │   │   └── PaymentTool.ts           # Gateway de pagamento
│   │   │   │
│   │   │   ├── middleware/
│   │   │   │   ├── rateLimit.ts             # Rate limiting por agente
│   │   │   │   ├── audit.ts                 # Auditoria de chamadas
│   │   │   │   └── idempotency.ts           # Garantia de idempotência
│   │   │   │
│   │   │   └── consumers/
│   │   │       └── ToolCallConsumer.ts      # Consome tools.call.requested
│   │   │
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   └── k8s/
│   │       ├── deployment.yaml
│   │       └── service.yaml
│   │
│   ├── memory-manager/                        # ✅ Fase 3.3.1 - Gerenciamento de memória
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── MemoryService.ts
│   │   │   │
│   │   │   ├── layers/                       # Camadas de memória
│   │   │   │   ├── WorkingMemory.ts         # Redis - TTL curto
│   │   │   │   ├── WorkflowState.ts         # Postgres - estado do fluxo
│   │   │   │   ├── StructuredFacts.ts       # Postgres - fatos estruturados
│   │   │   │   └── SemanticMemory.ts        # pgvector - RAG
│   │   │   │
│   │   │   ├── consumers/
│   │   │   │   └── MemoryUpdateConsumer.ts  # Consome memory.update.requested
│   │   │   │
│   │   │   └── api/
│   │   │       ├── MemoryController.ts      # API REST para memória
│   │   │       └── routes.ts
│   │   │
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   └── k8s/
│   │       ├── deployment.yaml
│   │       └── service.yaml
│   │
│   └── dispatcher/                            # ✅ Fase 3.4.1 - Orquestrador robusto
│       ├── src/
│       │   ├── index.ts
│       │   ├── DispatcherService.ts
│       │   ├── IntentClassifier.ts           # Classificação de intenção
│       │   ├── AgentRouter.ts                # Roteamento para agentes
│       │   │
│       │   ├── consumers/
│       │   │   └── MessageReceivedConsumer.ts
│       │   │
│       │   └── rules/                        # Regras de roteamento
│       │       ├── TriageRules.ts
│       │       ├── SalesRules.ts
│       │       └── SupportRules.ts
│       │
│       ├── package.json
│       ├── Dockerfile
│       └── k8s/
│           ├── deployment.yaml
│           └── service.yaml
│
├── k8s/                                        # [CRIAR] Kubernetes configs (Fase 3)
│   ├── namespace.yaml                         # ✅ Namespace isolado
│   ├── configmap.yaml                         # ✅ Configurações compartilhadas
│   ├── secrets.yaml                           # ✅ Secrets (API keys, DB passwords)
│   │
│   ├── deployments/                           # Deployments de cada serviço
│   │   ├── backend.yaml
│   │   ├── ai-agent.yaml
│   │   ├── tool-gateway.yaml
│   │   ├── memory-manager.yaml
│   │   ├── dispatcher.yaml
│   │   ├── redis.yaml
│   │   └── postgres.yaml
│   │
│   ├── services/                              # Services (ClusterIP/LoadBalancer)
│   │   ├── backend-service.yaml
│   │   ├── ai-agent-service.yaml
│   │   ├── tool-gateway-service.yaml
│   │   ├── memory-manager-service.yaml
│   │   ├── dispatcher-service.yaml
│   │   ├── redis-service.yaml
│   │   └── postgres-service.yaml
│   │
│   ├── ingress.yaml                           # ✅ Ingress para roteamento externo
│   │
│   ├── hpa/                                   # Horizontal Pod Autoscalers
│   │   ├── backend-hpa.yaml
│   │   ├── ai-agent-hpa.yaml
│   │   └── tool-gateway-hpa.yaml
│   │
│   ├── pvc/                                   # Persistent Volume Claims
│   │   ├── postgres-pvc.yaml
│   │   └── redis-pvc.yaml
│   │
│   └── monitoring/                            # Observabilidade
│       ├── prometheus.yaml
│       ├── grafana.yaml
│       └── jaeger.yaml
│
├── shared/                                     # [CRIAR] Código compartilhado
│   ├── types/                                 # Tipos TypeScript compartilhados
│   │   ├── events.d.ts
│   │   ├── models.d.ts
│   │   └── api.d.ts
│   │
│   └── libs/                                  # Bibliotecas compartilhadas
│       ├── eventBus.ts
│       ├── logger.ts
│       └── tracer.ts
│
├── docs/                                       # [EXPANDIR] Documentação
│   ├── ROADMAP-ARQUITETURA-ESCALAVEL.md      # ✅ Este roadmap
│   ├── CODEMAP-ARQUITETURA-ESCALAVEL.md      # ✅ Este codemap
│   ├── API.md                                 # Documentação de APIs
│   ├── EVENTS.md                              # Schema de eventos
│   ├── DEPLOYMENT.md                          # Guia de deployment
│   └── MONITORING.md                          # Guia de monitoramento
│
├── scripts/                                    # [CRIAR] Scripts de automação
│   ├── setup-dev.sh                           # Setup ambiente dev
│   ├── migrate-to-eventbus.sh                 # Migração para event bus
│   ├── deploy-k8s.sh                          # Deploy Kubernetes
│   └── load-test.sh                           # Testes de carga
│
├── docker-compose.yml                         # [MODIFICAR] Adicionar novos serviços
├── docker-compose.dev.yml                     # [CRIAR] Ambiente de desenvolvimento
└── docker-compose.prod.yml                    # [CRIAR] Ambiente de produção
```

---

## 🔧 Dependências Novas (package.json)

### Backend (Fase 1 e 2)

```json
{
  "dependencies": {
    "ioredis": "^5.3.2",              // [EXISTENTE] Redis client
    "bull": "^4.12.0",                // [EXISTENTE] Filas
    "uuid": "^9.0.1",                 // [ADICIONAR] Geração de IDs
    "winston": "^3.11.0",             // [EXISTENTE] Logger
    "express": "^4.18.2",             // [EXISTENTE]
    "socket.io": "^4.6.1",            // [EXISTENTE]
    "@socket.io/redis-adapter": "^8.2.1"  // [EXISTENTE]
  },
  "devDependencies": {
    "@types/uuid": "^9.0.7",          // [ADICIONAR]
    "typescript": "^5.3.3"            // [EXISTENTE]
  }
}
```

### Microserviços (Fase 3)

```json
{
  "dependencies": {
    "ioredis": "^5.3.2",
    "uuid": "^9.0.1",
    "winston": "^3.11.0",
    "openai": "^4.20.0",              // Para ai-agent
    "axios": "^1.6.2",                // Para tool-gateway
    "pg": "^8.11.3",                  // Postgres client
    "sequelize": "^6.35.2"            // ORM
  }
}
```

---

## 📋 Checklist de Implementação

### FASE 1: FUNDAÇÃO (4 semanas)

#### Semana 1: Observabilidade
- [ ] Criar `middleware/traceId.ts`
- [ ] Criar `utils/tracer.ts`
- [ ] Criar `types/trace.d.ts`
- [ ] Modificar `app.ts` para adicionar `traceMiddleware`
- [ ] Criar `middleware/metrics.ts`
- [ ] Criar `services/MetricsService.ts`
- [ ] Criar `routes/metricsRoutes.ts`
- [ ] Criar `controllers/MetricsController.ts`

#### Semana 2: Locks e Concorrência
- [ ] Criar `libs/conversationLock.ts`
- [ ] Criar `middleware/conversationLock.ts`
- [ ] Modificar `wbotMessageListener.ts` para usar locks
- [ ] Modificar `SendAIResponseService.ts` para usar locks
- [ ] Criar `services/MessageServices/MessageDeduplicationService.ts`
- [ ] Integrar deduplicação em `wbotMessageListener.ts`

#### Semana 3: Circuit Breaker
- [ ] Criar `libs/circuitBreaker.ts`
- [ ] Criar `services/IntegrationsServices/ResilientOpenAiService.ts`
- [ ] Modificar `SendAIResponseService.ts` para usar circuit breaker
- [ ] Adicionar fallbacks para chamadas externas

#### Semana 4: Otimização de Embeddings
- [ ] Criar `queues/EmbeddingQueue.ts`
- [ ] Criar `jobs/ProcessEmbeddingJob.ts`
- [ ] Modificar `RAG/EmbeddingService.ts` para usar fila
- [ ] Testar processamento assíncrono

---

### FASE 2: DESACOPLAMENTO (4 semanas)

#### Semana 5-6: Event Bus
- [ ] Criar `types/events.d.ts` com todos os schemas
- [ ] Criar `libs/eventBus.ts` com Redis Streams
- [ ] Criar `services/EventBusService.ts`
- [ ] Modificar `server.ts` para inicializar EventBus
- [ ] Criar `consumers/MessageReceivedConsumer.ts`
- [ ] Modificar `wbotMessageListener.ts` para publicar eventos
- [ ] Testar fluxo completo de eventos

#### Semana 7-8: Dispatcher
- [ ] Criar `services/DispatcherService.ts`
- [ ] Criar `consumers/DispatcherConsumer.ts`
- [ ] Implementar lógica de classificação de intenção
- [ ] Implementar roteamento para agentes
- [ ] Criar `consumers/AIAgentConsumer.ts`
- [ ] Criar `consumers/ToolExecutionConsumer.ts`
- [ ] Testar orquestração completa

---

### FASE 3: MICROSERVIÇOS (6 semanas)

#### Semana 9-10: Agente IA
- [ ] Criar projeto `services/ai-agent/`
- [ ] Implementar `AgentService.ts`
- [ ] Implementar `ContextManager.ts`
- [ ] Implementar `ResponseGenerator.ts`
- [ ] Criar `consumers/AIHandoffConsumer.ts`
- [ ] Criar Dockerfile
- [ ] Criar configs Kubernetes
- [ ] Testar isoladamente

#### Semana 11-12: Tool Gateway
- [ ] Criar projeto `services/tool-gateway/`
- [ ] Implementar `ToolGatewayService.ts`
- [ ] Implementar `ToolRegistry.ts`
- [ ] Implementar `RBACManager.ts`
- [ ] Migrar tools existentes
- [ ] Implementar rate limiting
- [ ] Implementar auditoria
- [ ] Criar Dockerfile e configs K8s

#### Semana 13-14: Kubernetes e Deploy
- [ ] Criar todos os YAMLs em `k8s/`
- [ ] Configurar namespace
- [ ] Configurar secrets e configmaps
- [ ] Configurar deployments
- [ ] Configurar services
- [ ] Configurar ingress
- [ ] Configurar HPAs
- [ ] Configurar monitoramento (Prometheus/Grafana)
- [ ] Testes de carga
- [ ] Deploy em produção

---

## 🎯 Fluxo de Dados (Arquitetura Final)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ARQUITETURA FINAL                           │
└─────────────────────────────────────────────────────────────────────┘

WhatsApp API
     │
     ▼
┌─────────────────┐
│  Backend API    │  (Ingress)
│  (Express)      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    REDIS STREAMS (Event Bus)                        │
│                                                                     │
│  Streams:                                                           │
│  • inbox.message.received                                           │
│  • routing.handoff.requested                                        │
│  • agent.ai.response.generated                                      │
│  • tools.call.requested / completed                                 │
│  • memory.update.requested                                          │
└─────────────────────────────────────────────────────────────────────┘
         │
         ├──────────────────┬──────────────────┬──────────────────┐
         ▼                  ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Dispatcher    │  │  AI Agent   │  │Tool Gateway │  │Memory Mgr   │
│  (Orquestrador) │  │(Microserviço│  │(Microserviço│  │(Microserviço│
└────────┬────────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
         │                  │                │                │
         │                  │                │                │
         ▼                  ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         STORAGE LAYER                               │
│                                                                     │
│  • Redis (working memory, cache, locks)                            │
│  • Postgres (tickets, messages, contacts, workflow state)          │
│  • pgvector (RAG, semantic memory)                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Exemplo de Fluxo Completo

### Mensagem do Cliente → Resposta IA

```
1. WhatsApp envia mensagem
   ↓
2. Backend API recebe (wbotMessageListener)
   ↓
3. Publica evento: inbox.message.received
   ↓
4. Dispatcher consome evento
   ↓
5. Dispatcher:
   - Adquire lock (conversation_id)
   - Verifica deduplicação
   - Classifica intenção
   - Publica: routing.handoff.requested (toAgent: "ai-agent")
   ↓
6. AI Agent consome evento
   ↓
7. AI Agent:
   - Busca contexto do Memory Manager
   - Gera resposta (OpenAI)
   - Publica: agent.ai.response.generated
   ↓
8. Backend consome resposta
   ↓
9. Backend:
   - Salva mensagem no DB
   - Emite via Socket.IO para frontend
   - Libera lock
   ↓
10. Cliente recebe resposta no WhatsApp
```

---

## 📊 Métricas e Monitoramento

### Endpoints de Health Check

```
GET /health                    # Status geral
GET /health/ready              # Pronto para receber tráfego
GET /health/live               # Processo está vivo
GET /metrics                   # Métricas Prometheus
```

### Métricas Importantes

```
# HTTP
http_requests_total{method, path, status}
http_request_duration_seconds{method, path}

# Event Bus
events_published_total{stream, event_type}
events_consumed_total{stream, consumer_group}
events_processing_duration_seconds{stream}

# AI
ai_requests_total{model, agent}
ai_tokens_used_total{model, agent}
ai_request_duration_seconds{model}

# Locks
locks_acquired_total{resource_type}
locks_failed_total{resource_type}
locks_duration_seconds{resource_type}

# Circuit Breaker
circuit_breaker_state{service}
circuit_breaker_failures_total{service}
```

---

## 🚀 Scripts de Automação

### setup-dev.sh
```bash
#!/bin/bash
# Setup ambiente de desenvolvimento

echo "🚀 Configurando ambiente de desenvolvimento..."

# Subir Redis e Postgres
docker-compose -f docker-compose.dev.yml up -d redis postgres

# Instalar dependências
cd backend && npm install
cd ../services/ai-agent && npm install
cd ../tool-gateway && npm install

# Rodar migrations
cd ../../backend && npm run db:migrate

echo "✅ Ambiente pronto!"
```

### migrate-to-eventbus.sh
```bash
#!/bin/bash
# Migração gradual para event bus

echo "🔄 Migrando para Event Bus..."

# Habilitar event bus em modo dual (publica eventos MAS mantém lógica antiga)
export EVENT_BUS_MODE=dual

# Reiniciar backend
pm2 restart backend

# Monitorar logs
pm2 logs backend --lines 100
```

---

## 📚 Documentação Adicional

### EVENTS.md
Documentar todos os eventos com exemplos:
- Schema completo
- Payloads de exemplo
- Consumers esperados
- Fluxos de retry

### API.md
Documentar todas as APIs REST:
- Endpoints
- Autenticação
- Rate limits
- Exemplos de uso

### DEPLOYMENT.md
Guia completo de deploy:
- Pré-requisitos
- Configuração de secrets
- Deploy Kubernetes
- Rollback
- Troubleshooting

---

**Documento criado em:** 22/12/2025  
**Versão:** 1.0  
**Autor:** Cascade AI
