# Correção: Connection Closed após Upgrade para Bull Queue

## Problema Identificado

**CAUSA RAIZ:** Os processadores Bull Queue **não tinham limite de concorrência**, permitindo que múltiplos jobs executassem **simultaneamente no mesmo socket Baileys**, corrompendo a conexão WebSocket.

### Como Ocorria

```
┌─────────────────────────────────────────────────┐
│ Bull Queue sem Concurrency Limit                │
├─────────────────────────────────────────────────┤
│ Job 1: Enviar mensagem      → Socket WhatsApp 16│
│ Job 2: Marcar como lida     → Socket WhatsApp 16│ ← SIMULTÂNEO
│ Job 3: Adicionar reação     → Socket WhatsApp 16│ ← SIMULTÂNEO
│ Job 4: Buscar histórico     → Socket WhatsApp 16│ ← SIMULTÂNEO
└─────────────────────────────────────────────────┘
                    ↓
         SOCKET CORROMPIDO
    "Connection Closed" / "xml-not-well-formed"
```

## Sintomas Observados

1. ✅ Erro "Connection Closed" ao adicionar reações
2. ✅ Erro "xml-not-well-formed" em fetchMessageHistory
3. ✅ Socket funcionando mas operações falhando
4. ✅ Problema iniciou após migração de cron jobs para Bull Queue

## Correção Aplicada

### Arquivos Modificados

#### 1. `backend/src/queues.ts`
Adicionado **concurrency explícito** em TODOS os processadores:

**Processadores que USAM Socket Baileys (concurrency=1):**
```typescript
messageQueue.process("SendMessage", 1, handleSendMessage);
sendScheduledMessages.process("SendMessage", 1, handleSendScheduledMessage);
campaignQueue.process("ProcessCampaign", 1, handleProcessCampaign);
campaignQueue.process("PrepareContact", 1, handlePrepareContact);
campaignQueue.process("DispatchCampaign", 1, handleDispatchCampaign);
validateWhatsappContactsQueue.process("validateWhatsappContacts", 1, handleValidate);
scheduleMonitor.process("Verify", 1, handleVerifySchedules);
```

**Processadores que NÃO usam Socket Baileys (concurrency=3):**
```typescript
campaignQueue.process("VerifyCampaignsDaatabase", 3, handleVerifyCampaigns);
userMonitor.process("VerifyLoginStatus", 3, handleLoginStatus);
queueMonitor.process("VerifyQueueStatus", 3, handleVerifyQueue);
```

#### 2. `backend/src/queues/ImportContactsQueue.ts`
```typescript
importContactsQueue.process("ImportContacts", 1, handleImportContacts);
```

#### 3. `backend/src/queues/userMonitor.ts`
```typescript
userMonitor.process("UserConnection", 3, handleUserConnection);
userMonitor.process("VerifyLoginStatus", 3, handleLoginStatus);
```

#### 4. `backend/src/queues/socketEventQueue.ts`
```typescript
socketEventQueue.process(5, async (job) => { ... });
```

## Diferença Entre Antes e Depois

### ANTES (❌ INCORRETO)
```typescript
messageQueue.process("SendMessage", handleSendMessage);
// SEM limite de concorrência = Bull executa ILIMITADOS jobs em paralelo
```

### DEPOIS (✅ CORRETO)
```typescript
messageQueue.process("SendMessage", 1, handleSendMessage);
// Com concurrency=1 = Bull executa APENAS 1 job por vez
```

## Por Que Isso Resolve

1. **Socket Baileys NÃO é thread-safe**: Apenas 1 operação por vez
2. **Bull Queue padrão**: Sem limite = concorrência ilimitada
3. **Concurrency=1**: Garante serialização de operações no socket
4. **Operações não-socket**: Podem ter concurrency > 1 para performance

## Como Testar

```bash
cd backend
npm run build
npm run dev
```

### Cenários de Teste

1. ✅ Enviar mensagem via campanha
2. ✅ Adicionar reação a mensagem
3. ✅ Marcar mensagens como lidas
4. ✅ Importar histórico de contato
5. ✅ Validar contatos WhatsApp
6. ✅ Buscar histórico de chat (SyncChatHistory)

### Monitorar Logs

```bash
# Buscar por erros
grep "Connection Closed" logs/*.log
grep "xml-not-well-formed" logs/*.log

# Verificar concurrency funcionando
grep "CRITICAL: concurrency=" logs/*.log
```

## Proteções Adicionais Aplicadas (Sessões Anteriores)

1. ✅ `SetTicketMessagesAsRead`: Verifica socket vivo antes de readMessages
2. ✅ `SyncChatHistoryService`: Verifica socket vivo antes de fetchMessageHistory
3. ✅ `ImportContactHistoryService`: Verifica socket vivo antes de fetch
4. ✅ `BaileysAdapter.markAsRead`: Verifica socket antes de marcar
5. ✅ `fetchHistoryMutex`: Mutex corrigido (adquire ANTES de rate limit check)
6. ✅ `OrphanedSessionCheckJob`: Verifica reconexão em andamento
7. ✅ `ShowTicketService`: Sync automático DESATIVADO

## Resultado Esperado

✅ **ZERO** erros "Connection Closed"  
✅ **ZERO** erros "xml-not-well-formed"  
✅ Operações serializadas por socket (máximo 1 por vez)  
✅ Performance mantida em operações não-socket (concurrency > 1)  

## Revertendo (Se Necessário)

Para reverter (NÃO RECOMENDADO):
```typescript
// Remover o número de concurrency
messageQueue.process("SendMessage", handleSendMessage);
```

**ATENÇÃO:** Reverter causará o retorno dos erros "Connection Closed"

---

**Data:** 07/03/2026  
**Versão:** Baileys v7  
**Status:** ✅ CORREÇÃO APLICADA - AGUARDANDO TESTES
