# Plano de Migração CQRS - Whaticket

## ✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO

**Build:** ✅ Passou  
**Data:** 2025-02-04

---

## Overview

O CQRS (Command Query Responsibility Segregation) separa operações de **escrita** (Command) de **leitura** (Query). 

**Benefícios:**
- Escalabilidade independente (mais servidores para leitura, menos para escrita)
- Cache otimizado nas queries
- Eventos desacoplados (Event Bus)
- Melhor testabilidade

---

## Arquitetura Alvo

```
┌─────────────────────────────────────────────────────────────┐
│                         API Layer                            │
│  (Controllers - apenas validação e orquestração)            │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
          ▼                                       ▼
┌──────────────────────┐              ┌──────────────────────┐
│   Command Services   │              │    Query Services    │
│   (Escrita + Eventos)│              │    (Leitura + Cache) │
└──────────────────────┘              └──────────────────────┘
          │                                       │
          ▼                                       ▼
┌──────────────────────┐              ┌──────────────────────┐
│     Event Bus        │              │      Cache Layer     │
│  (Socket.IO emit)    │              │   (Redis/ memory)    │
└──────────────────────┘              └──────────────────────┘
```

---

## Status Atual

✅ **Já Implementado:**
- `MessageCommandService` - Comandos de mensagem
- `MessageQueryService` - Queries de mensagem
- `MessageEventBus` - Event Bus
- `CreateMessageService` - Já usa `emitSocketEvent`

---

## Lista de Migrações Realizadas

### ✅ FASE 1 - Core Messaging (CONCLUÍDO)

| # | Arquivo | Status | O que foi feito |
|---|---------|--------|-----------------|
| 1 | `wbotMessageListener.ts` | ✅ | `handleMsgAck` → `updateMessageAckByWid()` |
| 2 | `ProcessWhatsAppWebhook.ts` | ✅ | Status update → `updateMessageAckByWid()` |
| 3 | `MarkDeleteWhatsAppMessage.ts` | ✅ | Delete → `markMessageAsDeletedByWid()` |
| 4 | `SetTicketMessagesAsRead.ts` | ✅ | Bulk read → `markMessagesAsReadByTicket()` |

### ✅ FASE 2 - Controllers (CONCLUÍDO)

| # | Arquivo | Status | O que foi feito |
|---|---------|--------|-----------------|
| 5 | `MessageController.ts` - remove | ✅ | Delete → `MessageEventBus.publishMessageDeleted()` |
| 6 | `MessageController.ts` - addReaction | ✅ | Update → `MessageEventBus.publishMessageUpdated()` |
| 7 | `MessageController.ts` - transcribe | ✅ | Update → `MessageEventBus.publishMessageUpdated()` |
| 8 | `EditWhatsAppMessage.ts` | ✅ | Edit → `MessageEventBus.publishMessageUpdated()` |

### 📋 FASE 3 - Futuro (Tickets)

| # | Arquivo | Status | O que fazer |
|---|---------|--------|-------------|
| 9 | `UpdateTicketService.ts` | ⏳ | Criar `TicketCommandService` |
| 10 | `CreateTicketService.ts` | ⏳ | Criar `TicketQueryService` |
| 11 | `wbotClosedTickets.ts` | ⏳ | Usar TicketCommandService |

---

## Detalhes das Migrações

### 1. wbotMessageListener.ts - handleMsgAck

**Arquivo:** `backend/src/services/WbotServices/wbotMessageListener.ts`
**Linha:** ~5630-5655

**Código Atual:**
```typescript
await messageToUpdate.update({ ack: chat });
// ... log ...
const { emitToCompanyRoom } = await import("../../libs/socketEmit");
await emitToCompanyRoom(
  messageToUpdate.companyId,
  messageToUpdate.ticket.uuid,
  `company-${messageToUpdate.companyId}-appMessage`,
  { action: "update", message: messageToUpdate },
  false
);
```

**Código Novo:**
```typescript
const { updateMessageAck } = await import("../MessageServices/MessageCommandService");
await updateMessageAck(messageToUpdate.id, messageToUpdate.companyId, chat);
// Isso já faz: update no DB + emite evento via EventBus
```

---

### 2. ProcessWhatsAppWebhook.ts

**Arquivo:** `backend/src/services/WbotServices/ProcessWhatsAppWebhook.ts`
**Linha:** ~730-750

**Código Atual:**
```typescript
await message.update({ ack });
// ... emitToCompanyRoom ...
```

**Código Novo:**
```typescript
const { updateMessageAck } = await import("../MessageServices/MessageCommandService");
await updateMessageAck(message.id, companyId, ack);
```

---

### 3-5. DeleteWhatsAppMessage*.ts

**Arquivos:**
- `DeleteWhatsAppMessage.ts`
- `DeleteWhatsAppMessageUnified.ts`
- `MarkDeleteWhatsAppMessage.ts`

**Mudança:** Substituir `message.update({ isDeleted: true })` + emit por:
```typescript
const { deleteMessage } = await import("../MessageServices/MessageCommandService");
await deleteMessage(messageId, companyId);
```

---

### 6. MessageController.ts

**Arquivo:** `backend/src/controllers/MessageController.ts`

**Endpoints para refatorar:**
- `GET /messages/:ticketId` → usar `MessageQueryService.listMessages`
- `POST /messages/:ticketId` → usar `MessageCommandService.createMessage`
- `PUT /messages/:messageId` → usar `MessageCommandService.updateMessage`
- `DELETE /messages/:messageId` → usar `MessageCommandService.deleteMessage`

---

### 9. Ticket Services (Fase 2)

Criar novos arquivos:
- `backend/src/services/TicketServices/TicketCommandService.ts`
- `backend/src/services/TicketServices/TicketQueryService.ts`
- `backend/src/services/TicketServices/TicketEventBus.ts`

Migrar:
- `UpdateTicketService.ts`
- `CreateTicketService.ts`
- `ShowTicketService.ts`
- `ListTicketsService.ts`

---

## Ordem de Execução Recomendada

### Fase 1 - Mensagens (Semana 1)
1. ✅ MessageCommandService (pronto)
2. ✅ MessageQueryService (pronto)
3. ✅ CreateMessageService (pronto)
4. Migrar `wbotMessageListener.ts` - handleMsgAck
5. Migrar `ProcessWhatsAppWebhook.ts`
6. Migrar deletes (3 arquivos)
7. Testar integração

### Fase 2 - Controllers (Semana 2)
8. Refatorar `MessageController.ts`
9. Refatorar `ChatService/CreateMessageService.ts`
10. Refatorar `EditWhatsAppMessage.ts`
11. Testar API

### Fase 3 - Tickets (Semana 3-4)
12. Criar TicketCommandService
13. Criar TicketQueryService
14. Criar TicketEventBus
15. Migrar UpdateTicketService
16. Migrar CreateTicketService
17. Migrar ListTicketsService
18. Testar tickets

### Fase 4 - Cleanup (Semana 5)
19. Remover código legado não usado
20. Atualizar imports
21. Documentar
22. Testes de regressão

---

## Testes Pós-Migração

### Mensagens
- [ ] Enviar mensagem → aparece em tempo real
- [ ] Receber mensagem → aparece em tempo real
- [ ] Status de entrega (ACK) atualiza
- [ ] Deletar mensagem → some da tela
- [ ] Editar mensagem → atualiza

### Tickets
- [ ] Criar ticket → aparece na lista
- [ ] Atualizar status → reflete na UI
- [ ] Transferir ticket → atualiza responsável
- [ ] Fechar ticket → some da lista

---

## Rollback Strategy

Se algo der errado:

1. **Fase 1 (Mensagens):**
   - Reverter para `emitToCompanyRoom` direto
   - Manter lógica de DB igual

2. **Fase 2 (Controllers):**
   - Git revert nos controllers
   - Services antigos ainda funcionam

3. **Fase 3 (Tickets):**
   - Feature flag para usar CQRS ou não
   - Fallback automático para código antigo

---

## Comandos Úteis

```bash
# Verificar arquivos que usam emitToCompanyRoom
grep -r "emitToCompanyRoom" src/ --include="*.ts" | wc -l

# Verificar arquivos que usam getIO().of
grep -r "getIO()" src/ --include="*.ts" | wc -l

# Verificar Message.update/create/upsert
grep -r "Message\.\(update\|create\|upsert\)" src/services --include="*.ts"
```

---

## Métricas de Sucesso

- ✅ Nenhuma regressão funcional
- ✅ Tempo de resposta da API mantido ou melhorado
- ✅ Menos código duplicado
- ✅ Eventos centralizados no EventBus
- ✅ Cache funcionando (QueryService)

---

**Nota:** A migração é **gradual**. O sistema funciona com código misto (parte CQRS, parte legado) durante a transição.
