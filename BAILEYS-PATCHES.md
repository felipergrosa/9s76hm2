# Patches de Estabilidade Baileys - v1.0

## Resumo

Implementação de patches para resolver instabilidades críticas do Baileys:
- Reconexões em loop infinito
- Erros de protocolo não tratados (`xml-not-well-formed`)
- Sockets zumbis (conexão aparentemente aberta mas não funcional)
- LID mapping duplicado e inconsistente
- Timeouts excessivos

---

## 1. Circuit Breaker (ALTA PRIORIDADE)

### Arquivo: `backend/src/libs/wbot.ts`

**Problema:**
- Reconexões infinitas sem limite após erros de protocolo
- Sem backoff exponencial para erros críticos
- `xml-not-well-formed` tratado como desconexão comum

**Solução:**
```typescript
// Configuração do Circuit Breaker
const CIRCUIT_BREAKER_THRESHOLD = 5;           // Após 5 falhas, abre o circuito
const CIRCUIT_BREAKER_WINDOW_MS = 300_000;     // Janela de 5 minutos
const CIRCUIT_BREAKER_COOLDOWN_MS = 300_000;   // 5 minutos de cooldown após abrir
const CIRCUIT_BREAKER_MAX_DELAY = 60_000;      // Delay máximo de reconexão

// Erros críticos de protocolo que disparam o circuit breaker
const CRITICAL_PROTOCOL_ERRORS = [
  'xml-not-well-formed',
  'stream errored',
  'connection reset',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
];
```

**Comportamento:**
1. Detecta erro crítico de protocolo
2. Registra falha no Circuit Breaker
3. Aplica backoff exponencial: 5s → 10s → 20s → 40s → 60s
4. Após 5 falhas em 5 minutos: **ABRE O CIRCUITO** (bloqueia reconexões por 5 min)
5. Executa cleanup Signal antes de reconectar
6. Notifica frontend quando circuito está aberto

**Logs:**
```
[CircuitBreaker] Falha #3 para whatsappId=123. Próxima tentativa em 20s. Erro: xml-not-well-formed
[CircuitBreaker] CIRCUITO ABERTO para whatsappId=123. Bloqueando reconexões por 300s.
```

---

## 2. SignalErrorHandler Estendido (ALTA PRIORIDADE)

### Arquivo: `backend/src/services/WbotServices/SignalErrorHandler.ts`

**Problema:**
- Só detectava erros de decriptação Signal (Bad MAC, SessionError)
- Não incluía erros de protocolo WebSocket

**Solução:**
```typescript
// Padrões de erro Signal (decriptação)
const SIGNAL_ERROR_PATTERNS = [
  "bad mac",
  "no matching sessions",
  "failed to decrypt",
  // ...
];

// Padrões de erro de PROTOCOLO críticos (WebSocket/XML)
const PROTOCOL_ERROR_PATTERNS = [
  "xml-not-well-formed",
  "stream errored",
  "connection reset",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
];

// Novos métodos
static isProtocolError(error: any): boolean;
static isCriticalError(error: any): boolean; // Signal OU Protocolo
```

---

## 3. LID Mapping Unificado (ALTA PRIORIDADE)

### Arquivos:
- `backend/src/services/WbotServices/StartWhatsAppSessionUnified.ts` (removido handler duplicado)
- `backend/src/services/WbotServices/wbotMonitor.ts` (handler principal melhorado)

**Problema:**
- Dois handlers duplicados para `lid-mapping.update`
- Polling de LIDs pendentes sem retry
- Intervalo de 5 minutos muito alto

**Solução:**
1. Removido handler duplicado do `StartWhatsAppSessionUnified.ts`
2. Handler unificado no `wbotMonitor.ts` com:
   - Persistência de mapeamentos
   - Merge de contatos duplicados
   - Promoção de contatos PENDING_ para reais

3. Polling melhorado:
```typescript
const LID_POLL_INTERVAL = 2 * 60 * 1000; // 2 minutos (reduzido de 5min)
const MAX_LID_RETRIES = 3; // Máximo de tentativas por LID

// Map para rastrear tentativas de resolução por LID
const lidRetryMap = new Map<string, { count: number; lastAttempt: number }>();

// Backoff: após 3 falhas, só tentar novamente após 10 minutos
```

---

## 4. Health Check Periódico (MÉDIA PRIORIDADE)

### Arquivo: `backend/src/services/WbotServices/wbotMonitor.ts`

**Problema:**
- Socket pode estar `readyState=1` (OPEN) mas não funcional
- Sem detecção de sockets zumbis
- Sessões mortas permaneciam no pool

**Solução:**
```typescript
const HEALTH_CHECK_INTERVAL = 30 * 1000; // 30 segundos
const MAX_FAILED_PINGS = 3;

// Health check executa:
// 1. Verifica se sessão existe no pool
// 2. Verifica se está reconectando (pula se sim)
// 3. Verifica readyState do WebSocket (2=CLOSING, 3=CLOSED)
// 4. Envia ping leve: sendPresenceUpdate("available")
// 5. Se 3 pings falharem → forçar reconexão
```

**Logs:**
```
[HealthCheck] Socket 123 com readyState=3 (1/3 falhas)
[HealthCheck] Socket 123 não responde a pings, forçando reconexão
[HealthCheck] Socket 123 recuperado (2 falhas anteriores)
```

---

## 5. Timeouts Otimizados (BAIXA PRIORIDADE)

### Arquivos:
- `backend/src/libs/wbot.ts`
- `backend/src/libs/messageHistoryHandler.ts`

**Mudanças:**
| Constante | Antes | Depois |
|-----------|-------|--------|
| `RECONNECT_STALE_THRESHOLD_MS` | 120s (2min) | 60s (1min) |
| `FETCH_HISTORY_TIMEOUT_MS` | 60s | 30s (configurável via env) |

**Env vars:**
```bash
FETCH_HISTORY_TIMEOUT_MS=30000  # Timeout para fetch de histórico
```

---

## Fluxo de Reconexão Completo

```
Erro de conexão
    ↓
É erro crítico de protocolo?
    ├─ SIM → Registra no Circuit Breaker
    │         ├─ Delay exponencial: 5s → 10s → 20s → 40s → 60s
    │         ├─ Cleanup Signal antes de reconectar
    │         └─ Se 5 falhas em 5min → CIRCUITO ABERTO (bloqueia 5min)
    │
    └─ NÃO → Delay fixo de 5s
    ↓
Verificar se circuito está aberto
    ├─ ABERTO → Bloquear reconexão, notificar frontend
    └─ FECHADO → Prosseguir
    ↓
Verificar se já está reconectando
    ├─ SIM → Ignorar (evitar duplicação)
    └─ NÃO → Setar flag de reconexão
    ↓
Agendar reconexão com delay calculado
    ↓
StartWhatsAppSession
    ↓
Conexão bem-sucedida?
    ├─ SIM → Resetar Circuit Breaker + contadores
    └─ NÃO → Registrar falha no Circuit Breaker
```

---

## Monitoramento

### Logs para observar:

**Circuit Breaker:**
```
[CircuitBreaker] Falha #N para whatsappId=X
[CircuitBreaker] CIRCUITO ABERTO para whatsappId=X
[CircuitBreaker] Resetado para whatsappId=X
```

**Health Check:**
```
[HealthCheck] Socket X com readyState=Y
[HealthCheck] Socket X não responde a pings
[HealthCheck] Socket X recuperado
```

**LID Mapping:**
```
[wbotMonitor] lid-mapping.update processado: total=N, saved=M, reconciled=K
[wbotMonitor] Polling: X LIDs resolvidos, Y em backoff
```

**Signal Cleanup:**
```
[wbot][SignalCleanup] Limpando chaves Signal para X antes de reconectar...
[wbot][SignalCleanup] ✅ N arquivos Signal removidos, M preservados
```

---

## Configuração via Environment

```bash
# Circuit Breaker (valores padrão)
CIRCUIT_BREAKER_THRESHOLD=5        # Falhas para abrir circuito
CIRCUIT_BREAKER_WINDOW_MS=300000    # Janela de 5 minutos
CIRCUIT_BREAKER_COOLDOWN_MS=300000  # Cooldown de 5 minutos

# Signal Error Handler
SIGNAL_ERROR_THRESHOLD=5            # Erros para disparar recovery
SIGNAL_ERROR_WINDOW_MS=30000        # Janela de 30 segundos
SIGNAL_MAX_RECOVERIES_HOUR=2        # Máximo de recoveries por hora
SIGNAL_RECOVERY_DELAY_MS=5000       # Delay antes de reconectar

# Timeouts
FETCH_HISTORY_TIMEOUT_MS=30000      # Timeout para fetch de histórico
RECONNECT_STALE_THRESHOLD_MS=60000  # Limite para flag de reconexão stale
```

---

## Validação

### Build:
```bash
cd backend && npm run build  # ✅ Passou
```

### Testes manuais recomendados:
1. Simular desconexão por `xml-not-well-formed` (verificar Circuit Breaker)
2. Matar socket manualmente e verificar Health Check detecta
3. Criar contato com LID pendente e verificar polling resolve
4. Verificar logs de Circuit Breaker após 5 reconexões falhas

---

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `backend/src/libs/wbot.ts` | Circuit Breaker + tratamento de erros críticos |
| `backend/src/services/WbotServices/SignalErrorHandler.ts` | Estendido para erros de protocolo |
| `backend/src/services/WbotServices/StartWhatsAppSessionUnified.ts` | Removido handler duplicado de LID |
| `backend/src/services/WbotServices/wbotMonitor.ts` | LID unificado + Health Check |
| `backend/src/libs/messageHistoryHandler.ts` | Timeout otimizado |

---

## Rollback

Se necessário reverter:

1. **Circuit Breaker:** Comentar bloco `CIRCUIT BREAKER` em `wbot.ts` (linhas 150-264)
2. **Health Check:** Comentar bloco `HEALTH CHECK PERIÓDICO` em `wbotMonitor.ts` (linhas 689-809)
3. **LID Handler:** Restaurar handler em `StartWhatsAppSessionUnified.ts` (ver histórico git)
4. **Timeouts:** Reverter constantes para valores originais

---

## Próximos Passos (Opcional)

1. **Métricas:** Exportar status do Circuit Breaker para Prometheus/Grafana
2. **Alertas:** Integrar com sistema de alertas para circuitos abertos
3. **Dashboard:** Visualizar sessões com Circuit Breaker ativo
4. **Auto-recovery avançado:** Detectar padrões de falha e aplicar correções automáticas

---

**Data:** 2026-03-10
**Versão:** 1.0
**Modo:** N2 (Produção)
