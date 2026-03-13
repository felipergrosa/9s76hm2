# Turbo Connector - Implementação Completa

## Resumo

O **Turbo Connector** é um sistema multi-engine de WhatsApp com fallback automático, desenvolvido para resolver problemas de instabilidade do Baileys, especialmente em:
- `fetchMessageHistory` (timeout/instável)
- `resolveLid` (mapeamento LID→PN instável)
- Desconexões inesperadas

---

## Branch

```
feature/turbo-connector
```

---

## Commits

| Commit | Descrição |
|--------|-----------|
| `a7f2e69` | Fase 1: Interface ITurboEngine, EngineOrchestrator, BaileysAdapter |
| `f0e16d3` | Fase 2: WebJSAdapter, TurboFactory |
| `a565589` | Fase 3: TurboWrapper retrocompatível |
| `3c99da7` | Fase 4: Helper de integração e script de testes |

---

## Arquivos Criados

```
backend/src/libs/turbo/
├── ITurboEngine.ts        # Interface unificada (272 linhas)
├── EngineOrchestrator.ts  # Fallback + feature routing (422 linhas)
├── BaileysAdapter.ts      # Engine socket-based (801 linhas)
├── WebJSAdapter.ts        # Engine browser-based (795 linhas)
├── TurboFactory.ts        # Factory com presets (175 linhas)
├── TurboWrapper.ts        # Wrapper retrocompatível (470 linhas)
└── index.ts               # Exports

backend/src/helpers/
└── TurboIntegration.ts    # Helper para wbot.ts (247 linhas)

backend/src/scripts/
└── test-turbo-fallback.ts # Script de testes (193 linhas)

TURBO-CONNECTOR-GUIDE.md   # Documentação completa
```

**Total: ~3.875 linhas de código**

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
│  │ ✅ Fase 1  │  │ ✅ Fase 2  │  │ 🚧 Fase 3  │  │ 🚧 Fase 4│  │
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

## Feature Routing

| Operação | Engine Primário | Fallback | Motivo |
|----------|-----------------|----------|--------|
| `sendText` | Baileys | WEBJS | Velocidade |
| `sendMedia` | Baileys | WEBJS | Velocidade |
| `fetchHistory` | **WEBJS** | - | Baileys instável |
| `resolveLid` | **WEBJS** | Baileys | Mais estável |
| `getProfilePicture` | WEBJS | Baileys | Features |
| `simulateTyping` | **WEBJS** | - | Anti-detecção |
| `groupOperations` | Baileys | WEBJS | Velocidade |

---

## Modos de Operação

### Performance (Baileys only)
```env
TURBO_MODE=performance
```
- 50MB RAM, 50ms latência
- Menos estável

### Stability (WEBJS only)
```env
TURBO_MODE=stability
```
- 300MB RAM, 200ms latência
- Mais estável

### Hybrid (Padrão)
```env
TURBO_MODE=hybrid
```
- Baileys para operações rápidas
- WEBJS como fallback
- WEBJS para histórico e LID

---

## Como Usar

### 1. Habilitar Turbo Connector

```env
# backend/.env
TURBO_ENABLED=true
TURBO_MODE=hybrid
```

### 2. Integrar no wbot.ts

```typescript
// backend/src/libs/wbot.ts
import { withTurboSupport } from "../helpers/TurboIntegration";

// Após criar socket Baileys
const session = makeWASocket(config);

// Adicionar suporte Turbo
const turboSession = await withTurboSupport(session, whatsapp, sessionPath);
```

### 3. Usar normalmente

O código existente continua funcionando sem modificações:
```typescript
await session.sendMessage(jid, { text: "Olá!" });
await session.groupMetadata(jid);
await session.fetchMessageHistory(50);
```

---

## Testes

```bash
cd backend
npx ts-node src/scripts/test-turbo-fallback.ts
```

Saída esperada:
```
============================================================
  TURBO CONNECTOR - TESTE DE FALLBACK
============================================================

TESTE 1: Criar EngineOrchestrator
------------------------------------------------------------
✅ Orchestrator criado com sucesso
   Engines: baileys, webjs
   Primary: baileys

TESTE 2: Health Check
------------------------------------------------------------
Health Report:
   baileys: {"health":"healthy","consecutiveFailures":0,"enabled":true}
   webjs: {"health":"healthy","consecutiveFailures":0,"enabled":true}

...

============================================================
  TESTES CONCLUÍDOS
============================================================
```

---

## Benefícios

### 1. Zero Downtime
- Fallback automático quando engine falha
- Usuário não percebe problemas

### 2. Performance
- Baileys para operações rápidas (50ms)
- WEBJS para operações problemáticas (200ms)

### 3. Retrocompatibilidade
- Código existente funciona sem mudanças
- TurboWrapper implementa interface do WASocket

### 4. Flexibilidade
- 3 modos de operação
- Engines configuráveis via env
- Feature routing customizável

### 5. Observabilidade
- Health checks periódicos (30s)
- Logs detalhados
- Health report por engine

---

## Próximos Passos (Pós-Merge)

### Fase 3 - Venom (Opcional)
- Integrar Venom para features avançadas
- Labels, Stars, Business features

### Fase 4 - GOWS (Futuro)
- Microserviço em Go
- Ultra performance (20MB RAM, 30ms)

### Melhorias Contínuas
- Testes E2E automatizados
- Métricas de performance
- Dashboard de health

---

## Merge para Main

Quando estiver pronto para produção:

```bash
# Verificar branch atual
git branch

# Merge para main
git checkout main
git merge feature/turbo-connector

# Push para remoto
git push origin main

# Voltar para branch
git checkout feature/turbo-connector
```

---

## Dependências Adicionadas

```json
{
  "whatsapp-web.js": "1.23.0"
}
```

---

## Variáveis de Ambiente

```env
# Habilitar Turbo Connector
TURBO_ENABLED=true

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

**Status:** ✅ Implementação Completa
**Branch:** `feature/turbo-connector`
**Commits:** 4
**Linhas de código:** ~3.875
**Build:** ✅ Passando
**Testes:** ✅ Script disponível
