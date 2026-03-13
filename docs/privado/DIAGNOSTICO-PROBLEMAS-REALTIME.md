# 🔍 DIAGNÓSTICO - Problemas em Tempo Real

## 📊 PROBLEMAS IDENTIFICADOS

### **1. Timeout no SyncChatHistory** ⚠️
```
WARN [03-05-2026 01:19:51]: [HistoryHandler] Timeout na requisição (60000ms)
WARN [03-05-2026 01:19:51]: [SyncChatHistory] Retry falhou: Error: Timeout ao buscar histórico
```

**Causa:** Timeout de 60s muito curto para buscar histórico completo.

**Impacto:** 
- Tela branca ao abrir ticket (se sync bloquear)
- Histórico não carrega

---

### **2. Mensagens Não Atualizam em Tempo Real** ⚠️

**Evidência nos Logs:**
```
INFO [03-05-2026 01:17:50]: [SOCKET EMIT] room=024423c9-9bb0-40d5-bf28-abc87c5a2df9 + broadcast ns=/workspace-1 event=company-1-appMessage
[CreateMessageService] Emissão sucesso para sala 024423c9-9bb0-40d5-bf28-abc87c5a2df9
```

**Backend emitindo corretamente**, mas frontend não atualiza.

**Possíveis Causas:**
1. Frontend não está escutando evento `company-1-appMessage`
2. Filtro de mensagens rejeitando updates
3. Dispatch do reducer não atualizando estado
4. Socket desconectado

---

## 🔍 ANÁLISE DO CÓDIGO FRONTEND

### **MessagesList/index.js - Linha 1224-1298**

**Listener do evento:**
```javascript
const onAppMessageMessagesList = (data) => {
  // Verifica se mensagem pertence ao ticket atual
  let shouldHandle = false;
  
  if (hasUuid && currentUuid && String(evtUuid) === String(currentUuid)) {
    shouldHandle = true;
  } else if (!urlIsUuid && evtTicketId && String(evtTicketId) === String(ticketId)) {
    shouldHandle = true;
  }
  
  if (!shouldHandle) {
    console.debug("[MessagesList] Rejeitando mensagem de outro ticket");
    return; // ❌ PODE ESTAR REJEITANDO MENSAGENS VÁLIDAS
  }
  
  if (data.action === "create") {
    dispatch({ type: "ADD_MESSAGE", payload: data.message });
  }
}

socket.on(`company-${companyId}-appMessage`, onAppMessageMessagesList);
```

**Problema Potencial:**
- Filtro muito restritivo pode rejeitar mensagens válidas
- Comparação de UUID pode falhar se formato diferente
- `currentRoomIdRef.current` pode estar desatualizado

---

## 🎯 SOLUÇÕES PROPOSTAS

### **Solução 1: Aumentar Timeout do SyncChatHistory**

**Arquivo:** `backend/src/services/MessageServices/SyncChatHistoryService.ts`

**Mudança:**
```typescript
// Linha ~260
const fetchPromise = startFetchRequest(fetchId, jid, 60000); // ❌ 60s
// Para:
const fetchPromise = startFetchRequest(fetchId, jid, 120000); // ✅ 120s
```

---

### **Solução 2: Tornar Sync Não-Bloqueante**

**Arquivo:** `backend/src/services/TicketServices/ShowTicketService.ts`

**Linha 292-296:**
```typescript
if (whatsapp?.syncOnTicketOpen) {
  // Executa sync em background (não bloqueia abertura do ticket)
  SyncChatHistoryService({ ticketId: id, companyId }).catch((err: any) => {
    logger.warn(`[ShowTicket] Erro ao sincronizar histórico: ${err?.message}`);
  });
}
```

**✅ JÁ ESTÁ CORRETO** - Sync não bloqueia abertura do ticket.

**Problema deve ser outro:** Verificar se erro no sync está causando exceção não tratada.

---

### **Solução 3: Melhorar Logs do Frontend**

**Adicionar logs detalhados para debug:**

```javascript
const onAppMessageMessagesList = (data) => {
  console.log("[MessagesList] appMessage recebido:", {
    action: data?.action,
    messageId: data?.message?.id,
    ticketId: data?.message?.ticketId,
    evtUuid: data?.message?.ticket?.uuid,
    currentTicketId: ticketId,
    currentUuid: currentRoomIdRef.current,
    shouldHandle: shouldHandle
  });
  
  // ... resto do código
}
```

---

### **Solução 4: Verificar Conexão Socket**

**Adicionar verificação de conexão:**

```javascript
useEffect(() => {
  const checkConnection = setInterval(() => {
    if (!socket.connected) {
      console.warn("[MessagesList] Socket desconectado! Tentando reconectar...");
      socket.connect();
    }
  }, 5000);
  
  return () => clearInterval(checkConnection);
}, [socket]);
```

---

## 🧪 TESTES PARA VALIDAR

### **Teste 1: Verificar Emissão Backend**
```bash
# Logs devem mostrar:
[SOCKET EMIT] room=<uuid> + broadcast ns=/workspace-1 event=company-1-appMessage
```
✅ **FUNCIONANDO** - Logs confirmam emissão

### **Teste 2: Verificar Recebimento Frontend**
```javascript
// Console do navegador deve mostrar:
[MessagesList] appMessage recebido: {...}
```
❓ **VERIFICAR** - Usuário deve checar console

### **Teste 3: Verificar Filtro de Mensagens**
```javascript
// Se mostrar "Rejeitando mensagem", filtro está bloqueando
[MessagesList] Rejeitando mensagem de outro ticket
```
❓ **VERIFICAR** - Pode ser a causa

---

## 📋 PLANO DE AÇÃO

1. ✅ Aumentar timeout do SyncChatHistory (60s → 120s)
2. ✅ Adicionar logs detalhados no frontend
3. ✅ Verificar se socket está conectado
4. ⏳ Testar e validar correções
5. ⏳ Ajustar filtro se necessário

---

**Próximo passo:** Implementar correções e pedir ao usuário para verificar console do navegador.
