# Regras de Criação de Tickets

## Objetivo
Garantir que interações internas (bot/humano) criem novos tickets seguindo a regra de 24h, e que campanhas respondidas movam para `pending` sem criar ticket ainda.

## Fluxo Atual vs Esperado

### 1. Campanha Respondida

**Atual:**
- Cliente responde campanha → ticket muda de `campaign` para `pending`/`bot`
- Ticket existente é reutilizado

**Esperado:**
- Cliente responde campanha → ticket muda de `campaign` para `pending`
- **NÃO cria novo ticket** ainda
- Aguarda aceite humano/bot

**Implementação:**
- `wbotMessageListener.ts` linha 5680: OK (já muda para `pending`)
- `FindOrCreateTicketService.ts`: Quando `isCampaign=true`, não aplicar regra de 24h

### 2. Aceite Humano

**Atual:**
- Aceitar ticket `pending` → atualiza ticket existente

**Esperado:**
- Aceitar ticket `pending` → **verifica regra de 24h**
- Se > 24h → **cria novo ticket**
- Se < 24h → reabre ticket existente

**Implementação:**
- `UpdateTicketService.ts`: Ao mudar status de `pending` para `open`, verificar se deve criar novo ticket
- Alternativa: Frontend chama `FindOrCreateTicketService` antes de aceitar

### 3. Bot Aceita

**Atual:**
- Mensagem cai na fila com bot → ticket vira `bot`
- Ticket existente é reutilizado

**Esperado:**
- Mensagem cai na fila com bot → **verifica regra de 24h**
- Se > 24h → **cria novo ticket** com status `bot`
- Se < 24h → reabre ticket existente como `bot`

**Implementação:**
- `FindOrCreateTicketService.ts` linha 274: Quando muda para `bot`, verificar se deve criar novo ticket

## Mudanças Necessárias

### A. FindOrCreateTicketService.ts

**Linha 197-204:** Quando `isCampaign=true`, NÃO aplicar regra de 24h
```typescript
if (isCampaign) {
  // Campanha: apenas atualizar ticket existente, não criar novo
  await ticket.update({
    userId: userId !== ticket.userId ? ticket.userId : userId,
    queueId: queueId !== ticket.queueId ? ticket.queueId : queueId,
  });
  ticket = await ShowTicketService(ticket.id, companyId);
  ticketEventBus.publishTicketUpdated(companyId, ticket.id, ticket.uuid, ticket);
  return ticket;
}
```

**Linha 274-365:** Quando ticket `pending` vira `bot`, aplicar regra de 24h
- Se > 24h → criar novo ticket
- Se < 24h → atualizar ticket existente

### B. UpdateTicketService.ts (ou equivalente)

Quando aceitar ticket `pending` manualmente:
- Verificar se > 24h desde última interação
- Se sim → criar novo ticket via `FindOrCreateTicketService`
- Se não → atualizar ticket existente

### C. wbotMessageListener.ts

**Linha 5680-5705:** Campanha respondida
- Manter lógica atual (muda para `pending`)
- **NÃO** criar novo ticket

## Resumo das Regras

| Cenário | Status Atual | Ação | Tempo | Resultado |
|---------|--------------|------|-------|-----------|
| Campanha respondida | `campaign` | Cliente responde | qualquer | Muda para `pending` (sem criar ticket) |
| Aceite humano | `pending` | Aceitar | > 24h | **Cria novo ticket** |
| Aceite humano | `pending` | Aceitar | < 24h | Reabre ticket existente |
| Bot aceita | `pending` | Mensagem entra | > 24h | **Cria novo ticket** com status `bot` |
| Bot aceita | `pending` | Mensagem entra | < 24h | Muda para `bot` (mesmo ticket) |
| Ticket aberto | `open` | Nova mensagem | qualquer | Mantém ticket |
