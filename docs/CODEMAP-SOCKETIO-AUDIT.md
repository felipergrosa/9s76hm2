# CODEMAP — Auditoria Completa Socket.IO + Mensagens

**Data:** 2026-02-10 | **Modo:** N1 (Production) | **Status:** Diagnóstico completo

---

## 🗺️ MAPA DO FLUXO COMPLETO

```
┌─────────────────────────────────────────────────────────────────┐
│                    WHATSAPP (Baileys)                            │
│  messages.upsert → handleMessage()                              │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│  wbotMessageListener.ts :: handleMessage()                      │
│                                                                 │
│  1. isValidMsg(msg) → filtra tipos válidos                      │
│  2. resolveMessageContact() → Contact                           │
│  3. FindOrCreateTicketService() → Ticket                        │
│  4. verifyMessage() / verifyMediaMessage()                      │
│     └─→ CreateMessageService() → Message (upsert no DB)        │
│         └─→ emitSocketEvent() → Socket.IO                      │
│  5. Se ticket.status=closed → ticket.update(pending)            │
│     └─→ ⚠️ BUG: io.of().to(uuid).emit() [SEM broadcast]       │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│  CreateMessageService.ts                                        │
│                                                                 │
│  1. Validação integridade ticket/contact (LOG-ONLY ⚠️)          │
│  2. Message.upsert({ wid, companyId }) ← findOne por wid ⚠️    │
│  3. emitSocketEvent(companyId, ticket.uuid, appMessage, payload)│
│     └─→ emitToCompanyRoom()                                    │
│         └─→ ns.to(room).emit() + ns.emit() [broadcast OK ✅]   │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│  socketEmit.ts :: emitToCompanyRoom()                           │
│                                                                 │
│  Namespace: /workspace-${companyId}                             │
│  Se room=null  → ns.emit() [broadcast]                          │
│  Se room!=null → ns.to(room).emit()                             │
│    + Se appMessage → ns.emit() [broadcast adicional] ✅         │
│    + Se ticket     → SÓ room, SEM broadcast ⚠️                 │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│              FRONTEND (Socket.IO Client)                         │
│                                                                 │
│  SocketWorker.js (Singleton)                                    │
│  └─→ io("/workspace-${companyId}")                              │
│  └─→ activeRooms + joinBuffer + auto-rejoin                    │
│                                                                 │
│  Componentes que escutam:                                       │
│  ┌──────────────────┬─────────────────┬────────────────────┐   │
│  │ TicketsListCustom │ MessagesList    │ Ticket/index.js    │   │
│  │ (abas open/pend) │ (chat aberto)   │ (header + sala)    │   │
│  │                  │                  │                    │   │
│  │ ticket event ✅  │ appMessage ✅   │ ticket event ✅   │   │
│  │ appMessage ✅    │                  │ contact event ✅  │   │
│  │ contact event ✅ │                  │                    │   │
│  └──────────────────┴─────────────────┴────────────────────┘   │
│                                                                 │
│  ⚠️ TicketsListCustom NÃO está na sala UUID do ticket!          │
│  ⚠️ Ele depende de BROADCAST para receber eventos               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔴 BUGS CRÍTICOS ENCONTRADOS

### BUG-1: verifyMessage — Emissão direta SEM broadcast (CRÍTICO)
**Arquivo:** `wbotMessageListener.ts:2094-2101`
**Impacto:** Ticket reabre (closed→pending) mas NÃO aparece na lista "Aguardando"

```typescript
// PROBLEMA: emite SOMENTE para a sala UUID do ticket
// TicketsListCustom NÃO está nessa sala → NUNCA recebe o evento
io.of(`/workspace-${companyId}`)
  .to(ticket.uuid)                    // ← SÓ para quem está na sala
  .emit(`company-${companyId}-ticket`, { action: "update", ticket });
```

**Contraste com verifyMediaMessage (CORRETO):**
```typescript
// verifyMediaMessage usa TicketEventBus → broadcast → TicketsListCustom recebe ✅
ticketEventBus.publishTicketDeleted(companyId, ticket.id, ticket.uuid, "closed");
ticketEventBus.publishTicketUpdated(companyId, ticket.id, ticket.uuid, ticket);
```

---

### BUG-2: handleMessage bot/queue close — Emissão direta SEM broadcast (CRÍTICO)
**Arquivo:** `wbotMessageListener.ts:6035-6051`
**Impacto:** Tickets fechados por bot não saem da lista em realtime

```typescript
// PROBLEMA: mesmo padrão — só emite para sala UUID
io.of(`/workspace-${companyId}`)
  .to(ticket.uuid)
  .emit(`company-${companyId}-ticket`, { action: "delete", ... });
io.of(`/workspace-${companyId}`)
  .to(ticket.uuid)
  .emit(`company-${companyId}-ticket`, { action: "update", ... });
```

---

### BUG-3: Reaction delete — Emite para ticketId numérico (CRÍTICO)
**Arquivo:** `wbotMessageListener.ts:4890-4895`
**Impacto:** Delete de reação nunca chega ao frontend

```typescript
// PROBLEMA: salas são por UUID, não por ID numérico
io.of(`/workspace-${companyId}`)
  .to(targetMessage.ticketId.toString())  // ← ID NUMÉRICO! Sala não existe
  .emit(`company-${companyId}-appMessage`, { action: "delete", ... });
```

---

### BUG-4: Edited message — Room-only sem broadcast
**Arquivo:** `wbotMessageListener.ts:5220-5225`
**Impacto:** Edições de mensagem podem não chegar se sala estiver vazia

```typescript
io.of(`/workspace-${companyId}`)
  .to(ticket.uuid)
  .emit(`company-${companyId}-appMessage`, { action: "update", message });
// Sem broadcast fallback → se sala vazia, mensagem editada não aparece
```

---

### BUG-5: MessageController.edit — appMessage room-only
**Arquivo:** `MessageController.ts:1172-1181`
**Impacto:** Edição de mensagem via UI pode não chegar ao chat aberto

```typescript
io.of(`/workspace-${companyId}`).to(ticket.uuid).emit(appMessage);  // room-only ⚠️
io.of(`/workspace-${companyId}`).emit(ticket);                       // broadcast ✅
```

---

### BUG-6: CreateMessageService — upsert por wid SEM ticketId
**Arquivo:** `CreateMessageService.ts:59-64`
**Impacto:** Mensagens podem ir para ticket errado

```typescript
await Message.upsert({ ...messageData, companyId });
// findOne busca por wid + companyId, MAS NÃO por ticketId
const message = await Message.findOne({
  where: { wid: messageData.wid, companyId }  // ← SEM ticketId!
});
```

Se dois tickets do mesmo contato existem e a mesma mensagem é processada
duas vezes (ex: MessageController.store + handleMessage para msg fromMe),
o upsert pode sobrescrever o ticketId, e o findOne retorna do ticket errado.

---

### BUG-7: CreateMessageService — Validação de integridade LOG-ONLY
**Arquivo:** `CreateMessageService.ts:46-57`
**Impacto:** Mensagem é salva no ticket errado mesmo quando detectada

```typescript
if (ticketCheck.contactId !== messageData.contactId) {
  logger.error("ALERTA DE INTEGRIDADE");  // ← SÓ LOG! Não impede a criação
}
// A mensagem é criada mesmo com contactId inconsistente
```

---

### BUG-8: Auth JWT permissivo
**Arquivo:** `socket.ts:104-125`
**Impacto:** Qualquer conexão é aceita (segurança)

```typescript
// Token ausente → next() [permite]
// Token inválido → next() [permite]
// Erro → next() [permite]
```

---

### BUG-9: SocketWorker.off() chama connect()
**Arquivo:** `SocketWorker.js:226-227`
**Impacto:** Cleanup de listeners pode forçar reconexão desnecessária

```javascript
off(event, callback) {
  this.connect();  // ← POR QUE reconectar ao remover listener?
  // ...
}
```

---

## 📊 TABELA DE CONSISTÊNCIA DOS EMISSORES

| Arquivo | Evento | Método | Broadcast? | Status |
|---------|--------|--------|-----------|--------|
| CreateMessageService | appMessage | emitSocketEvent → emitToCompanyRoom | ✅ room + broadcast | OK |
| TicketEventBus.UPDATED | ticket | emitSocketEvent(null) → ns.emit | ✅ broadcast | OK |
| TicketEventBus.DELETED | ticket | emitSocketEvent(null) → ns.emit | ✅ broadcast | OK |
| verifyMessage (reopen) | ticket | io.of().to(uuid).emit | ❌ SÓ room | **BUG-1** |
| verifyMediaMessage (reopen) | ticket | ticketEventBus | ✅ broadcast | OK |
| handleMessage (bot close) | ticket | io.of().to(uuid).emit | ❌ SÓ room | **BUG-2** |
| handleMessage (reaction) | appMessage | io.of().to(id_numerico) | ❌ sala errada | **BUG-3** |
| handleMessage (edit) | appMessage | io.of().to(uuid).emit | ❌ SÓ room | **BUG-4** |
| MessageController.edit | appMessage | io.of().to(uuid).emit | ❌ SÓ room | **BUG-5** |
| MessageController.edit | ticket | io.of().emit | ✅ broadcast | OK |
| SetTicketMessagesAsRead | ticket | io.of().emit | ✅ broadcast | OK |
| UpdateTicketByRemoteJid | ticket | io.of().emit | ✅ broadcast | OK |
| UpdateTicketService | ticket | ticketEventBus | ✅ broadcast | OK |

---

## 🛣️ CAMINHOS DE SOLUÇÃO

### CAMINHO A: Correção Cirúrgica (Mínimo risco, máximo impacto)
**Esforço:** ~2h | **Risco:** Baixo | **Cobertura:** 90% dos problemas

Substituir TODAS as emissões diretas `io.of().to(room).emit()` por chamadas ao
`emitSocketEvent()` ou `ticketEventBus` conforme o tipo de evento:

```
1. verifyMessage (reopen):     io.of().to() → ticketEventBus (igual verifyMediaMessage)
2. handleMessage (bot close):  io.of().to() → ticketEventBus
3. handleMessage (reaction):   io.of().to(numericId) → emitSocketEvent(uuid)
4. handleMessage (edit):       io.of().to() → emitSocketEvent + broadcast
5. MessageController.edit:     io.of().to() → emitSocketEvent + broadcast
6. CreateMessageService:       Adicionar ticketId no findOne
7. CreateMessageService:       Rejeitar mensagem se integridade falhar
8. SocketWorker.off():         Remover this.connect()
```

**Vantagens:** Mudanças pontuais, fácil de testar, não mexe na arquitetura.
**Desvantagens:** Não resolve o problema de fundo (código espalhado).

---

### CAMINHO B: Centralização Total via Event Bus (Recomendado)
**Esforço:** ~6h | **Risco:** Médio | **Cobertura:** 100%

Eliminar TODAS as chamadas diretas `io.of()` dos services/controllers.
Toda emissão Socket.IO passa por exatamente 2 pontos:

```
Para eventos de TICKET:    ticketEventBus.publish*(...)
Para eventos de MENSAGEM:  messageEventBus.publish*(...)

                ┌──────────────┐
                │ EventBus     │
                │ (singleton)  │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │ socketEmit   │  ← ÚNICO ponto de saída
                │ .ts          │
                └──────────────┘
```

Criar `MessageEventBus.ts`:
```typescript
class MessageEventBus extends EventEmitter {
  publishMessageCreated(companyId, ticketUuid, message, ticket, contact) { ... }
  publishMessageUpdated(companyId, ticketUuid, message) { ... }
  publishMessageDeleted(companyId, ticketUuid, messageId) { ... }
}
```

Handler centralizado garante:
- Emissão para sala UUID (entrega direta)
- Broadcast no namespace (fallback)
- Log estruturado de cada evento
- Validação de payload

**Vantagens:** Elimina toda inconsistência. Fácil de auditar. Um lugar para debugar.
**Desvantagens:** Mais alterações, requer cuidado com imports circulares.

---

### CAMINHO C: Refatoração Completa (Longo prazo)
**Esforço:** ~20h | **Risco:** Alto | **Cobertura:** 100% + futuro

Refatorar toda a arquitetura de comunicação:

```
1. Backend: Event-driven puro
   - Todos os serviços publicam eventos no EventBus
   - EventBus decide o que emitir via Socket.IO
   - Eliminar getIO() de todos os serviços

2. Frontend: State management centralizado
   - Criar SocketEventManager que recebe TODOS os eventos
   - SocketEventManager distribui para os stores corretos
   - Componentes assinam stores, não eventos socket diretamente

3. Autenticação corrigida
   - JWT obrigatório, não permissivo
   - Rooms por userId para eventos pessoais

4. Testes automatizados
   - Testes de integração para cada fluxo de evento
```

**Vantagens:** Arquitetura robusta, testável, escalável.
**Desvantagens:** Muito esforço, alto risco de regressão.

---

## ✅ RECOMENDAÇÃO

**Executar CAMINHO A imediatamente** (2h) para corrigir os bugs críticos.
Depois, implementar **CAMINHO B** (6h) para garantir que novas features
não reintroduzam inconsistências.

O CAMINHO C é ideal para uma sprint futura de refatoração.

---

## 📋 CHECKLIST DE CORREÇÃO (Caminho A)

- [ ] **BUG-1:** `verifyMessage` → usar ticketEventBus (igual verifyMediaMessage)
- [ ] **BUG-2:** `handleMessage` bot close → usar ticketEventBus
- [ ] **BUG-3:** Reaction delete → usar UUID em vez de ticketId numérico
- [ ] **BUG-4:** Edited message → adicionar broadcast fallback
- [ ] **BUG-5:** MessageController.edit → adicionar broadcast fallback
- [ ] **BUG-6:** CreateMessageService.findOne → adicionar ticketId na query
- [ ] **BUG-7:** CreateMessageService validação → rejeitar ou corrigir se inconsistente
- [ ] **BUG-8:** Auth JWT → modo strict (não-permissivo) — quando estável
- [ ] **BUG-9:** SocketWorker.off() → remover this.connect()
