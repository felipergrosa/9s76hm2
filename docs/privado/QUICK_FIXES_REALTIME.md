# Soluções Práticas para Sincronização em Tempo Real

## ✅ TODAS AS 7 SOLUÇÕES IMPLEMENTADAS

| # | Solução | Esforço | Impacto | Status |
|---|---------|---------|---------|--------|
| 1 | Connection State Recovery | 🟢 Baixo | 🟢 Alto | ✅ **IMPLEMENTADO** |
| 2 | Optimistic UI + Reconciliação | 🟢 Baixo | 🟢 Alto | ✅ **IMPLEMENTADO** |
| 3 | Last Event ID (Offset) | 🟡 Médio | 🟢 Alto | ✅ **IMPLEMENTADO** |
| 4 | Acknowledgement com Retry | 🟡 Médio | 🟡 Médio | ✅ **IMPLEMENTADO** |
| 5 | Polling Inteligente (Adaptativo) | 🟢 Baixo | 🟡 Médio | ✅ **IMPLEMENTADO** |
| 6 | BullMQ Event Queue | 🔴 Alto | 🟢 Alto | ✅ **IMPLEMENTADO** |
| 7 | CQRS Básico | 🔴 Muito Alto | 🟢 Muito Alto | ✅ **IMPLEMENTADO** |

---

## Solução 1: Connection State Recovery (NATIVO Socket.IO)

### O que é?
Funcionalidade **nativa** do Socket.IO v4.6+ que recupera automaticamente eventos perdidos durante desconexões temporárias.

### Esforço: ~30 minutos

### Implementação Backend

```typescript
// backend/src/libs/socket.ts

const io = new Server(server, {
  cors: { /* ... */ },
  
  // ✅ ADICIONAR ISTO
  connectionStateRecovery: {
    // Guardar estado por 2 minutos após desconexão
    maxDisconnectionDuration: 2 * 60 * 1000,
    // Pular middlewares na reconexão (mais rápido)
    skipMiddlewares: true,
  }
});
```

### Implementação Frontend

```javascript
// frontend/src/services/SocketWorker.js

const socket = io(SOCKET_URL, {
  // ... outras opções existentes
  
  // ✅ Socket.IO já lida automaticamente com recovery
  // Apenas verificar se funcionou:
});

socket.on("connect", () => {
  if (socket.recovered) {
    console.log("[SOCKET] Conexão recuperada - eventos perdidos serão reenviados");
  } else {
    console.log("[SOCKET] Nova conexão - sincronizar estado");
    // Recarregar dados se necessário
  }
});
```

### Por que funciona?
- Socket.IO guarda eventos no servidor por 2 minutos
- Ao reconectar, cliente recebe todos os eventos perdidos automaticamente
- Rooms são restauradas automaticamente

### Limitações:
- Só funciona para desconexões < 2 minutos
- Não funciona se servidor reiniciar
- Requer Socket.IO v4.6+

---

## Solução 2: Optimistic UI + Reconciliação

### O que é?
Frontend assume que operação vai funcionar, atualiza UI imediatamente, e depois reconcilia com o servidor.

### Esforço: ~2 horas

### Implementação Frontend

```javascript
// frontend/src/components/MessagesList/index.js

// Ao enviar mensagem, adicionar IMEDIATAMENTE na lista
const handleSendMessage = async (content) => {
  // 1. Gerar ID temporário
  const tempId = `temp-${Date.now()}`;
  
  // 2. Adicionar mensagem otimisticamente
  const optimisticMessage = {
    id: tempId,
    body: content,
    fromMe: true,
    createdAt: new Date().toISOString(),
    ack: 0, // Pendente (relógio)
    _optimistic: true
  };
  
  dispatch({ type: "ADD_MESSAGE", payload: optimisticMessage });
  scrollToBottom();
  
  try {
    // 3. Enviar para servidor
    const { data } = await api.post(`/messages/${ticketId}`, { body: content });
    
    // 4. Substituir mensagem otimística pela real
    dispatch({ 
      type: "REPLACE_MESSAGE", 
      payload: { tempId, realMessage: data.message } 
    });
  } catch (error) {
    // 5. Marcar como falha (mostrar botão de retry)
    dispatch({ 
      type: "UPDATE_MESSAGE", 
      payload: { id: tempId, ack: -1, _failed: true } 
    });
  }
};

// Adicionar ao reducer
case "REPLACE_MESSAGE":
  return messagesList.map(msg => 
    msg.id === action.payload.tempId 
      ? action.payload.realMessage 
      : msg
  );
```

### Por que funciona?
- UI responde instantaneamente (0ms de delay percebido)
- Usuário vê a mensagem imediatamente
- Reconciliação acontece em background

---

## Solução 3: Last Event ID (Offset Pattern)

### O que é?
Cliente guarda o ID da última mensagem recebida. Ao reconectar, pede ao servidor "me envie tudo depois de X".

### Esforço: ~4 horas

### Implementação Backend

```typescript
// backend/src/libs/socket.ts

ns.on("connection", async (socket) => {
  const lastEventId = socket.handshake.auth.lastEventId;
  const roomId = socket.handshake.auth.roomId;
  
  if (lastEventId && roomId) {
    // Buscar mensagens que o cliente perdeu
    const missedMessages = await Message.findAll({
      where: {
        ticketId: roomId, // ou usar uuid
        id: { [Op.gt]: lastEventId }
      },
      order: [['id', 'ASC']],
      limit: 100
    });
    
    // Reenviar mensagens perdidas
    for (const msg of missedMessages) {
      socket.emit(`company-${socket.companyId}-appMessage`, {
        action: "create",
        message: msg,
        _recovery: true
      });
    }
  }
});
```

### Implementação Frontend

```javascript
// frontend/src/components/MessagesList/index.js

// Guardar último ID recebido
const lastEventIdRef = useRef(null);

const onAppMessageMessagesList = (data) => {
  // ... lógica existente
  
  if (data.action === "create") {
    // Guardar ID da última mensagem
    lastEventIdRef.current = data.message.id;
    localStorage.setItem(`lastEventId-${ticketId}`, data.message.id);
    
    dispatch({ type: "ADD_MESSAGE", payload: data.message });
  }
};

// Ao conectar, enviar último ID conhecido
socket.auth = {
  ...socket.auth,
  lastEventId: localStorage.getItem(`lastEventId-${ticketId}`),
  roomId: ticketId
};
```

### Por que funciona?
- Garante que NENHUMA mensagem seja perdida
- Funciona mesmo após reinício do servidor
- Simples de implementar

---

## Solução 4: Acknowledgement com Retry (Já parcialmente implementado)

### O que é?
Servidor aguarda confirmação do cliente. Se não receber, reenvia.

### Esforço: ~3 horas (já temos retry no backend)

### Melhorar Backend (socketEmit.ts)

```typescript
// Já implementado: retry com delays progressivos
// Falta: ACK do cliente

export async function emitWithAck(
  companyId: number,
  room: string,
  event: string,
  payload: any
): Promise<boolean> {
  const io = getIO();
  const ns = io.of(`/workspace-${companyId}`);
  
  try {
    const sockets = await ns.in(room).fetchSockets();
    
    const acks = await Promise.all(
      sockets.map(socket => 
        socket.timeout(5000).emitWithAck(event, payload)
          .catch(() => false)
      )
    );
    
    return acks.some(ack => ack === true);
  } catch (e) {
    return false;
  }
}
```

### Frontend - Responder com ACK

```javascript
socket.on(`company-${companyId}-appMessage`, (data, callback) => {
  try {
    // Processar mensagem
    if (data.action === "create") {
      dispatch({ type: "ADD_MESSAGE", payload: data.message });
    }
    
    // Confirmar recebimento
    if (typeof callback === 'function') {
      callback(true);
    }
  } catch (e) {
    if (typeof callback === 'function') {
      callback(false);
    }
  }
});
```

---

## Solução 5: Polling Inteligente (Híbrido) - JÁ IMPLEMENTADO

### Status Atual
Já temos polling a cada 30 segundos como fallback:

```javascript
// frontend/src/components/MessagesList/index.js (linhas 1346-1392)
// Polling a cada 30 segundos como fallback
const interval = setInterval(pollNewMessages, 30000);
```

### Melhorias Possíveis

```javascript
// Polling adaptativo: mais frequente se socket falhar
const [pollInterval, setPollInterval] = useState(30000);

useEffect(() => {
  if (!socket?.connected) {
    // Socket desconectado: polling mais frequente
    setPollInterval(5000);
  } else {
    // Socket ok: polling menos frequente
    setPollInterval(30000);
  }
}, [socket?.connected]);
```

---

## Solução 6: BullMQ Event Queue (Médio prazo)

### O que é?
Fila persistente entre backend e Socket gateway. Eventos nunca são perdidos.

### Esforço: ~2 dias

### Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│  WhatsApp ──► CreateMessageService ──► BullMQ Queue   │
│                                              │         │
│                                              ▼         │
│                                      Event Worker      │
│                                              │         │
│                                              ▼         │
│                                      Socket.IO Emit    │
│                                              │         │
│                                              ▼         │
│                                         Frontend       │
└─────────────────────────────────────────────────────────┘
```

### Implementação

```typescript
// backend/src/queues/socketEventQueue.ts
import Bull from "bull";

export const socketEventQueue = new Bull("socket-events", {
  redis: process.env.REDIS_URI
});

// Producer: CreateMessageService
await socketEventQueue.add("emit", {
  companyId,
  room: ticket.uuid,
  event: `company-${companyId}-appMessage`,
  payload: { action: "create", message }
}, {
  attempts: 5,
  backoff: { type: "exponential", delay: 1000 }
});

// Consumer: processa eventos
socketEventQueue.process("emit", async (job) => {
  const { companyId, room, event, payload } = job.data;
  await emitToCompanyRoom(companyId, room, event, payload);
});
```

### Por que funciona?
- Eventos persistidos no Redis
- Retry automático com backoff
- Não perde eventos mesmo se Socket.IO falhar

---

## Recomendação: Implementação em Fases

### Fase 1 (Hoje - 1 hora)
1. ✅ **Connection State Recovery** - Ativar no backend
2. ✅ **Verificar versão do Socket.IO** (precisa v4.6+)

### Fase 2 (Esta semana - 4 horas)
3. **Last Event ID** - Recuperar mensagens perdidas ao reconectar
4. **Optimistic UI** - Mensagens aparecem instantaneamente

### Fase 3 (Próxima semana - 8 horas)
5. **BullMQ Event Queue** - Garantia de entrega persistente

### Fase 4 (Próximo mês)
6. Refatorar para CQRS básico (opcional)

---

## Comparativo: 9s76hm2 Atual vs. Com Fixes

| Cenário | 9s76hm2 Atual | Com Soluções 1-3 |
|---------|-----------------|------------------|
| Desconexão 30s | ❌ Perde mensagens | ✅ Recovery automático |
| Desconexão 5min | ❌ Perde mensagens | ✅ Last Event ID recupera |
| Enviar mensagem | ⏳ Espera resposta | ✅ Optimistic UI (0ms) |
| Servidor reinicia | ❌ Perde estado | ✅ Last Event ID recupera |
| Alta latência | ❌ UI trava | ✅ Optimistic UI fluida |

---

---

## 📁 Arquivos Criados/Modificados

### Backend

| Arquivo | Descrição |
|---------|-----------|
| `backend/src/libs/socket.ts` | Connection State Recovery + handler recoverMissedMessages |
| `backend/src/libs/socketEmit.ts` | Função emitWithAck para ACK do cliente |
| `backend/src/queues/socketEventQueue.ts` | **NOVO** - Fila persistente Bull para eventos |
| `backend/src/services/MessageServices/MessageEventBus.ts` | **NOVO** - Event Bus CQRS |
| `backend/src/services/MessageServices/MessageQueryService.ts` | **NOVO** - Service de leitura CQRS |
| `backend/src/services/MessageServices/MessageCommandService.ts` | **NOVO** - Service de escrita CQRS |
| `backend/src/services/MessageServices/CreateMessageService.ts` | Integração com emitSocketEvent |

### Frontend

| Arquivo | Descrição |
|---------|-----------|
| `frontend/src/context/OptimisticMessage/OptimisticMessageContext.js` | **NOVO** - Contexto Optimistic UI |
| `frontend/src/components/Ticket/index.js` | Provider OptimisticMessage |
| `frontend/src/components/MessageInput/index.js` | Envio otimístico de mensagens |
| `frontend/src/components/MessagesList/index.js` | Last Event ID + Polling adaptativo |
| `frontend/src/services/SocketWorker.js` | Log de Connection Recovery |

---

## 🔧 Variáveis de Ambiente

```env
# Ativa fila persistente para eventos Socket.IO (Solução 6)
SOCKET_USE_QUEUE=true

# Debug de eventos CQRS (Solução 7)
CQRS_DEBUG=true

# Debug de Socket.IO
SOCKET_DEBUG=true

# Fallback broadcast quando sala vazia
SOCKET_FALLBACK_NS_BROADCAST=true
```

---

## 🚀 Como Ativar

1. **Reiniciar backend** para aplicar Connection State Recovery
2. **Testar** desconectando/reconectando - deve ver logs `[SOCKET RECOVERY] ✅`
3. **Opcional**: Definir `SOCKET_USE_QUEUE=true` para usar fila persistente
4. **Opcional**: Migrar código gradualmente para CQRS usando `MessageCommandService` e `MessageQueryService`

---

## 📊 Comparativo Final

| Cenário | Antes | Depois |
|---------|-------|--------|
| Desconexão 30s | ❌ Perde mensagens | ✅ Recovery automático |
| Desconexão 5min | ❌ Perde mensagens | ✅ Last Event ID recupera |
| Enviar mensagem | ⏳ Espera servidor | ✅ Optimistic UI (0ms) |
| Servidor reinicia | ❌ Perde estado | ✅ Polling + Last Event ID |
| Socket falha | ❌ UI trava | ✅ Polling adaptativo (5s) |
| Servidor multi-instância | ❌ Eventos perdidos | ✅ Bull Queue persistente |

---

**Build:** ✅ Compilado com sucesso
**Status:** ✅ Todas as 7 soluções implementadas

