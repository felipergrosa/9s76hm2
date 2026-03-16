# Correção de Realtime no Processamento em Massa

## Problema

Ao processar tickets em massa via `BulkProcessTicketsService`, as alterações não eram refletidas em tempo real no frontend, exigindo atualização manual da página para visualizar as mudanças.

## Causa Raiz

1. **Namespace Socket.IO incorreto**: O serviço usava `io.of(String(companyId))` mas o sistema usa namespace `/workspace-{companyId}`
2. **Falta de emissão para tags**: Alterações de tags não emitiam eventos socket
3. **Falta de emissão para contatos**: Alterações de carteiras não emitiam eventos de contato

## Solução

### 1. Correção do Namespace Socket.IO

**Arquivo**: `backend/src/services/TicketServices/BulkProcessTicketsService.ts`

```typescript
// ANTES (incorreto)
io.of(String(companyId)).emit(`company-${companyId}-ticket`, {...});

// DEPOIS (correto)
io.of(`/workspace-${companyId}`).emit(`company-${companyId}-ticket`, {...});
```

### 2. Emissão de Eventos para Tags

Quando tags são alteradas sem mudança de status/fila, agora é emitido evento de update:

```typescript
// 3. Adicionar tags
if (tagIds && tagIds.length > 0) {
  await ticket.$set('tags', []);
  await ticket.$add('tags', tagIds);
  
  // Recarregar ticket com tags atualizadas para emitir evento
  const ticketWithTags = await Ticket.findByPk(ticket.id, {
    include: [
      { association: "tags", attributes: ["id", "name", "color"] },
      { model: Contact, as: "contact", attributes: ["id", "name", "number"] }
    ]
  });
  if (ticketWithTags) {
    io.of(`/workspace-${companyId}`).emit(`company-${companyId}-ticket`, {
      action: "update",
      ticket: ticketWithTags
    });
  }
}
```

### 3. Emissão de Eventos para Contatos (Carteiras)

Quando carteiras são atualizadas, é emitido evento de contato:

```typescript
// 7. Emitir eventos Socket.IO para contatos atualizados (carteiras)
if (contactUpdated && ticket.contactId) {
  const updatedContact = await Contact.findByPk(ticket.contactId, {
    attributes: ["id", "name", "number", "profilePicUrl", "email"],
    include: [
      { association: "wallets", attributes: ["id", "name"] },
      { association: "tags", attributes: ["id", "name", "color"] }
    ]
  });

  if (updatedContact) {
    io.of(`/workspace-${companyId}`).emit(`company-${companyId}-contact`, {
      action: "update",
      contact: updatedContact
    });
  }
}
```

## Fluxo de Eventos

### Tickets

1. **Status/Fila**: `UpdateTicketService` → `ticketEventBus.publishTicketUpdated()` → Socket.IO
2. **Tags**: `BulkProcessTicketsService` → emissão direta Socket.IO
3. **Fechamento**: `UpdateTicketService` → `ticketEventBus.publishTicketDeleted()` → Socket.IO

### Contatos

1. **Carteiras**: `BulkProcessTicketsService` → `UpdateContactWalletsService` → emissão direta Socket.IO

## Frontend - Listeners

O frontend já possui listeners corretos:

### `useTicketsRealtimeStore.js`

```javascript
// Tickets
socket.on(`company-${user.companyId}-ticket`, onCompanyTicket);

// Contatos
socket.on(`company-${user.companyId}-contact`, onCompanyContact);
```

### Handler de Contato

```javascript
const onCompanyContact = (data) => {
  if (data.action === "update" && data.contact) {
    dispatch({ type: "UPDATE_CONTACT", contact: data.contact });
  }
};
```

O reducer `UPDATE_CONTACT` atualiza todos os tickets que possuem o contato:

```javascript
case "UPDATE_CONTACT": {
  const ticketsById = { ...state.ticketsById };
  Object.keys(ticketsById).forEach(id => {
    const ticket = ticketsById[id];
    if (ticket?.contactId === action.contact.id) {
      ticketsById[id] = {
        ...ticket,
        contact: { ...(ticket.contact || {}), ...action.contact },
      };
    }
  });
  return { ...state, ticketsById };
}
```

## Eventos Emitidos

| Ação | Evento | Payload |
|------|--------|---------|
| Progresso | `company-{id}-bulk-process-progress` | `{ userId, progress, processed, total, success, errors }` |
| Conclusão | `company-{id}-bulk-process-complete` | `{ userId, result }` |
| Ticket Update (status/fila) | `company-{id}-ticket` | `{ action: "update", ticket }` |
| Ticket Delete (mudança de aba) | `company-{id}-ticket` | `{ action: "delete", ticketId }` |
| Ticket Update (tags) | `company-{id}-ticket` | `{ action: "update", ticket }` |
| Contato Update (carteiras) | `company-{id}-contact` | `{ action: "update", contact }` |

## Teste

1. Abrir modal de processamento em massa
2. Selecionar múltiplos tickets
3. Aplicar alterações (status, fila, tags, carteiras)
4. Verificar em tempo real:
   - Tickets migrando entre abas
   - Tags atualizando nos cards
   - Carteiras atualizando nos contatos

## Arquivos Modificados

- `backend/src/services/TicketServices/BulkProcessTicketsService.ts`
