# Turbo Connector - Guia de Integração

## Visão Geral

O **Turbo Connector** é um sistema multi-engine de WhatsApp que permite fallback automático entre diferentes bibliotecas, mantendo retrocompatibilidade total com o código existente.

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    TURBO CONNECTOR                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              ENGINE ORCHESTRATOR                          │   │
│  │  - Auto-fallback entre engines                            │   │
│  │  - Feature routing (melhor engine por operação)            │   │
│  │  - Health monitoring (30s ping)                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐  │
│  │  BAILEYS   │  │  WEBJS     │  │  VENOM     │  │  GOWS    │  │
│  │  (Socket)  │  │  (Browser) │  │  (Browser) │  │  (Go)    │  │
│  │            │  │            │  │            │  │          │  │
│  │ ✅ Rápido  │  │ ✅ Estável │  │ ✅ Avançado │  │ ✅ Leve  │  │
│  │ ⚠️ Instável│  │ ⚠️ Lento   │  │ ⚠️ Lento   │  │ ⚠️ Go    │  │
│  │ 50MB RAM   │  │ 300MB RAM  │  │ 300MB RAM  │  │ 20MB RAM │  │
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              TURBO WRAPPER                                │   │
│  │  - Interface compatível com WASocket                      │   │
│  │  - Código existente funciona sem mudanças                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Engines Disponíveis

| Engine | Tipo | RAM | Latência | Status |
|--------|------|-----|----------|--------|
| **Baileys** | Socket | 50MB | 50ms | ✅ Produção |
| **WEBJS** | Browser | 300MB | 200ms | ✅ Produção |
| **Venom** | Browser | 300MB | 200ms | 🚧 Fase 3 |
| **GOWS** | Go | 20MB | 30ms | 🚧 Fase 4 |

---

## Feature Routing

O sistema escolhe automaticamente o melhor engine para cada operação:

| Operação | Engine Primário | Fallback | Motivo |
|----------|-----------------|----------|--------|
| `sendText` | Baileys | WEBJS | Velocidade |
| `sendMedia` | Baileys | WEBJS | Velocidade |
| `fetchHistory` | **WEBJS** | - | Baileys bugado |
| `resolveLid` | **WEBJS** | Baileys | Mais estável |
| `getProfilePicture` | WEBJS | Baileys | Features |
| `simulateTyping` | **WEBJS** | - | Anti-detecção |
| `groupOperations` | Baileys | WEBJS | Velocidade |

---

## Modos de Operação

### 1. Performance (Baileys only)
```env
TURBO_MODE=performance
```
- ✅ Mais rápido (50ms latência)
- ✅ Menor consumo de memória (50MB)
- ⚠️ Menos estável (bugs de protocolo)

### 2. Stability (WEBJS only)
```env
TURBO_MODE=stability
```
- ✅ Mais estável
- ✅ Histórico e LID resolution funcionam
- ⚠️ Mais lento (200ms latência)
- ⚠️ Maior consumo de memória (300MB)

### 3. Hybrid (Padrão)
```env
TURBO_MODE=hybrid
```
- ✅ Baileys para operações rápidas
- ✅ WEBJS como fallback automático
- ✅ WEBJS para histórico e LID
- ⚠️ Memória variável (50-350MB)

---

## Configuração

### Variáveis de Ambiente

```env
# Modo de operação
TURBO_MODE=hybrid  # performance | stability | hybrid

# Engines específicos (sobrescreve modo)
# TURBO_ENGINES=baileys,webjs

# Health check
TURBO_HEALTH_CHECK_INTERVAL=30000  # ms
TURBO_MAX_FAILURES=3
TURBO_BACKOFF_MS=60000
```

---

## Uso

### Opção 1: TurboWrapper (Retrocompatível)

```typescript
import { createTurboWrapper } from "../libs/turbo";

// Criar wrapper
const wrapper = await createTurboWrapper({
  whatsapp: whatsappModel,
  sessionPath: "/path/to/session",
  mode: "hybrid",
});

// Usar como WASocket normal
await wrapper.sendMessage(jid, { text: "Olá!" });
await wrapper.groupMetadata(jid);
await wrapper.fetchMessageHistory(50);
```

### Opção 2: EngineOrchestrator (Avançado)

```typescript
import { TurboFactory } from "../libs/turbo";

// Criar orchestrator
const orchestrator = await TurboFactory.createOrchestrator({
  sessionId: "session-1",
  companyId: 1,
  whatsappId: 1,
  sessionPath: "/path/to/session",
  mode: "hybrid",
});

// Usar com feature routing automático
await orchestrator.sendText(jid, "Olá!");
await orchestrator.fetchHistory(jid, { limit: 50 });
await orchestrator.resolveLid(lid);
```

### Opção 3: Engine Único

```typescript
import { TurboFactory } from "../libs/turbo";

// Criar apenas Baileys
const baileys = await TurboFactory.createSingleEngine("baileys", config);

// Ou apenas WEBJS
const webjs = await TurboFactory.createSingleEngine("webjs", config);
```

---

## Integração com wbot.ts

### Habilitar Turbo Connector

```typescript
// backend/src/libs/wbot.ts

import { createTurboWrapper } from "./turbo";

// Dentro da função de criação de sessão
if (process.env.TURBO_ENABLED === "true") {
  const wrapper = await createTurboWrapper({
    whatsapp,
    sessionPath,
    mode: process.env.TURBO_MODE as any,
  });
  
  // Usar wrapper como socket
  session = wrapper as any;
} else {
  // Comportamento atual (Baileys direto)
  session = makeWASocket(config);
}
```

---

## Fallback Automático

### Cenário: Baileys falha

```
1. Usuário envia mensagem
   ↓
2. TurboWrapper tenta Baileys
   ↓
3. Baileys lança erro: "Bad MAC"
   ↓
4. TurboWrapper detecta falha
   ↓
5. Registra falha no orchestrator
   ↓
6. Fallback para WEBJS
   ↓
7. WEBJS envia mensagem com sucesso
   ↓
8. Usuário não percebe nada!
```

### Cenário: Histórico de mensagens

```
1. Frontend solicita histórico
   ↓
2. TurboWrapper chama fetchHistory
   ↓
3. Feature routing escolhe WEBJS (mais estável)
   ↓
4. WEBJS busca histórico
   ↓
5. Histórico retornado com sucesso
   ↓
6. Baileys nunca é usado (evita bugs)
```

---

## Monitoramento

### Health Report

```typescript
const health = orchestrator.getHealthReport();

console.log(health);
// {
//   baileys: { health: "healthy", consecutiveFailures: 0, enabled: true },
//   webjs: { health: "healthy", consecutiveFailures: 0, enabled: true }
// }
```

### Logs

```
[TurboWrapper] Inicializando para whatsappId=1
[TurboFactory] Criando orchestrator (mode: hybrid, engines: baileys, webjs)
[TurboOrchestrator] Engine registrado: baileys (priority: 2)
[TurboOrchestrator] Engine registrado: webjs (priority: 1)
[TurboOrchestrator] Health check iniciado (interval: 30000ms)
[TurboWrapper] Inicializado com sucesso

[TurboOrchestrator] Fallback: baileys -> webjs para fetchHistory
[TurboWrapper] fetchMessageHistory via orchestrator (WEBJS primário)
```

---

## Benefícios

### 1. Zero Downtime
- Fallback automático quando engine falha
- Usuário não percebe problemas

### 2. Performance
- Baileys para operações rápidas
- WEBJS para operações problemáticas

### 3. Retrocompatibilidade
- Código existente funciona sem mudanças
- TurboWrapper implementa interface do WASocket

### 4. Flexibilidade
- 3 modos de operação
- Engines configuráveis via env
- Feature routing customizável

### 5. Observabilidade
- Health checks periódicos
- Logs detalhados
- Health report por engine

---

## Limitações Atuais

### Fase 1-2 (Atual)
- ✅ Baileys e WEBJS funcionais
- ✅ Fallback automático
- ✅ Feature routing
- ⚠️ Venom e GOWS não implementados

### Fase 3 (Planejado)
- Venom para features avançadas (Labels, Stars)

### Fase 4 (Futuro)
- GOWS para ultra performance (Go microservice)

---

## Troubleshooting

### WEBJS não conecta
```bash
# Verificar se Puppeteer está instalado
npm install puppeteer

# Verificar dependências do Chrome
# Linux: sudo apt-get install -y chromium-browser
# Windows: Chrome já instalado
```

### Alto consumo de memória
```env
# Usar modo performance (só Baileys)
TURBO_MODE=performance
```

### Fallback não funciona
```bash
# Verificar logs
[TurboOrchestrator] Engine baileys marcado como UNHEALTHY

# Verificar health report
console.log(orchestrator.getHealthReport());
```

---

## Roadmap

| Fase | Status | Entregas |
|------|--------|----------|
| **1** | ✅ | Interface, Orchestrator, BaileysAdapter |
| **2** | ✅ | WebJSAdapter, TurboFactory, TurboWrapper |
| **3** | 🚧 | VenomAdapter, Labels, Stars |
| **4** | 📅 | GOWSAdapter (Go microservice) |
| **5** | 📅 | Testes E2E, Documentação final |

---

## Arquivos

```
backend/src/libs/turbo/
├── ITurboEngine.ts       # Interface unificada
├── EngineOrchestrator.ts # Fallback + feature routing
├── BaileysAdapter.ts     # Engine socket-based
├── WebJSAdapter.ts       # Engine browser-based
├── TurboFactory.ts       # Factory com presets
├── TurboWrapper.ts       # Wrapper retrocompatível
└── index.ts              # Exports
```

---

**Versão:** 1.0.0
**Branch:** feature/turbo-connector
**Status:** Fase 2 Completa
