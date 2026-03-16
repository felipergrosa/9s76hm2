# Padrão de Emissão de Eventos Socket.IO

## Objetivo

Garantir que **todas** as alterações em tickets, contatos e mensagens sejam refletidas em tempo real no frontend através de eventos Socket.IO.

---

## Regra de Ouro

> **Toda vez que `ticket.update()`, `contact.update()` ou `message.update()` for chamado diretamente (sem usar um Service que já emite eventos), DEVE-SE emitir o evento Socket.IO correspondente logo após.**

---

## Helper Centralizado

### `backend/src/helpers/emitTicketUpdate.ts`

```typescript
import { emitTicketUpdate, emitTicketUpdateSimple, emitTicketStatusChange } from "../../helpers/emitTicketUpdate";

// 1. Update simples (não muda status/aba)
await ticket.update({ lastMessage: "Nova mensagem" });
await emitTicketUpdateSimple(ticket, companyId);

// 2. Mudança de status (move entre abas)
const oldStatus = ticket.status;
await ticket.update({ status: "closed" });
await emitTicketStatusChange(ticket, companyId, oldStatus);

// 3. Update completo com controle
await emitTicketUpdate(ticket, companyId, oldStatus, { 
  skipDelete: false,  // emite delete se status mudou
  skipUpdate: false,  // emite update
  reload: true        // recarrega ticket com associações
});
```

---

## Quando Usar Cada Função

### `emitTicketUpdateSimple(ticket, companyId)`
- **Uso**: Mudanças que NÃO afetam status/aba
- **Exemplos**: `lastMessage`, `isOutOfHour`, `amountUsedBotQueues`, `useIntegration`, `integrationId`
- **Efeito**: Emite apenas `TICKET_UPDATED`

### `emitTicketStatusChange(ticket, companyId, oldStatus)`
- **Uso**: Mudanças de status que movem ticket entre abas
- **Exemplos**: `status: "closed"`, `status: "pending"`, `status: "open"`
- **Efeito**: Emite `TICKET_DELETED` (remove da aba antiga) + `TICKET_UPDATED` (adiciona na nova)

---

## Serviços que JÁ Emitem Eventos

### Tickets
- `UpdateTicketService` → usa `ticketEventBus.publishTicketUpdated/Deleted`
- `BulkProcessTicketsService` → emite eventos para tags e contatos

### Mensagens
- `CreateMessageService` → usa `messageEventBus.publishMessageCreated`
- `UpdateMessageService` → emite diretamente (deveria usar `MessageEventBus`)

### Contatos
- **NÃO existe `ContactEventBus` ainda**
- Atualizações de contato devem emitir manualmente:
  ```typescript
  io.of(`/workspace-${companyId}`).emit(`company-${companyId}-contact`, {
    action: "update",
    contact: updatedContact
  });
  ```

---

## Padrão de Namespace Socket.IO

### Backend
```typescript
// CORRETO
io.of(`/workspace-${companyId}`).emit(`company-${companyId}-ticket`, payload);

// INCORRETO (não funciona)
io.of(String(companyId)).emit(...);
io.of(`/company-${companyId}-mainchannel`).emit(...);
```

### Frontend
- O frontend conecta automaticamente ao namespace `/workspace-{companyId}`
- Eventos são recebidos em `useTicketsRealtimeStore.js`

---

## Eventos por Entidade

### Tickets
| Evento | Ação | Frontend |
|--------|------|----------|
| `company-{companyId}-ticket` | `action: "update"` | Atualiza ticket na lista |
| `company-{companyId}-ticket` | `action: "delete"` | Remove ticket da aba antiga |

### Mensagens
| Evento | Ação | Frontend |
|--------|------|----------|
| `company-{companyId}-appMessage` | `action: "create"` | Adiciona mensagem no chat |
| `company-{companyId}-appMessage` | `action: "update"` | Atualiza mensagem (edição, reação) |
| `company-{companyId}-appMessage` | `action: "delete"` | Remove mensagem |

### Contatos
| Evento | Ação | Frontend |
|--------|------|----------|
| `company-{companyId}-contact` | `action: "update"` | Atualiza contato na lista e tickets |

---

## Checklist de Correção

Ao encontrar `ticket.update()` direto:

1. ✅ Verificar se muda status (precisa de `emitTicketStatusChange`)
2. ✅ Se não muda status, usar `emitTicketUpdateSimple`
3. ✅ Verificar se companyId está disponível
4. ✅ Verificar se ticket tem `id` e `uuid` válidos
5. ✅ Testar no frontend se atualização aparece em tempo real

---

## Arquivos Corrigidos

### Sessão Atual (Auditoria de Eventos)

| Arquivo | Correção |
|---------|----------|
| `backend/src/helpers/emitTicketUpdate.ts` | **NOVO** - Helper centralizado |
| `backend/src/services/WebhookService/ActionsWebhookService.ts` | Adicionado `emitTicketStatusChange` e `emitTicketUpdateSimple` |
| `backend/src/services/WbotServices/wbotMonitor.ts` | Adicionado `emitTicketStatusChange` (chamada perdida) |
| `backend/src/services/WbotServices/wbotMessageListener.ts` | Adicionado `emitTicketUpdateSimple` em múltiplos pontos |

### Sessões Anteriores

| Arquivo | Correção |
|---------|----------|
| `backend/src/services/TicketServices/BulkProcessTicketsService.ts` | Corrigido namespace, adicionado eventos para tags e contatos |

---

## Testando Emissão de Eventos

### Backend (logs)
```typescript
logger.debug(`[emitTicketUpdate] Update emitido: ticket=${ticketData.id} status=${newStatus}`);
```

### Frontend (console)
```javascript
// Abrir DevTools > Console
// Verificar logs de recebimento de eventos:
// [Socket] Evento recebido: company-1-ticket { action: "update", ticket: {...} }
```

### Teste Manual
1. Abrir dois navegadores/abas com o mesmo ticket
2. Fazer alteração em um
3. Verificar se aparece no outro sem recarregar

---

## Próximos Passos

1. **Criar `ContactEventBus`** para padronizar emissão de eventos de contato
2. **Refatorar `UpdateMessageService`** para usar `MessageEventBus`
3. **Adicionar testes automatizados** para verificar emissão de eventos
4. **Auditar contatos** para encontrar `contact.update()` sem eventos

---

## Referências

- `backend/src/services/TicketServices/TicketEventBus.ts`
- `backend/src/services/MessageServices/MessageEventBus.ts`
- `frontend/src/hooks/useTicketsRealtimeStore.js`
- `docs/privado/FIX-REALTIME-BULK-PROCESS.md`
