# Auditoria de Bugs, Erros de Lógica e Vulnerabilidades

> Análise sistemática baseada nos Traces 1–17 do codemap.
> Modo: N2 (segurança + integridade de dados)
> Data: 2026-02-10

---

## Legenda de Severidade

| Nível | Significado |
|-------|-------------|
| 🔴 CRÍTICO | Perda de dados, falha de segurança, banimento WhatsApp |
| 🟠 ALTO | Bug visível para o usuário, dados inconsistentes |
| 🟡 MÉDIO | Comportamento inesperado em edge cases |
| 🟢 BAIXO | Code smell, performance, manutenibilidade |

---

## 1. ResolveLidToRealNumber.ts — Vulnerabilidades

### 🔴 BUG-1: onWhatsApp() usado como fallback (risco de banimento)

**Arquivo:** `ResolveLidToRealNumber.ts:84-118`

O método `resolveLidToRealNumber()` usa `wbot.onWhatsApp()` como fallback quando o store não tem o mapeamento. Isso faz requisição direta ao WhatsApp e pode causar banimento se chamado em massa (ex: `findAndMergeLidDuplicates` itera sobre TODOS os contatos LID).

```typescript
// LINHA 96-98 — PERIGO: onWhatsApp em loop
for (const testNumber of possibleNumbers) {
  const [result] = await wbot.onWhatsApp(`${testNumber}@s.whatsapp.net`);
```

**Impacto:** Se houver 200 contatos LID, são 200-400 chamadas `onWhatsApp()` → BAN.
**Fix:** Remover o fallback `onWhatsApp()` completamente. Usar apenas store/LidMapping.

---

### 🟡 BUG-2: findAndMergeLidDuplicates busca LID por number LIKE '%@lid'

**Arquivo:** `ResolveLidToRealNumber.ts:183-184`

```typescript
number: { [Op.like]: "%@lid" }
```

Contatos LID podem ter `number` no formato `PENDING_xxx` (não `xxx@lid`). Esta query não os encontra.

**Fix:** Adicionar `[Op.or]` incluindo `PENDING_%` e verificar `remoteJid LIKE %@lid`.

---

### 🟡 BUG-3: Atualização de número sem canonicalNumber

**Arquivo:** `ResolveLidToRealNumber.ts:233-235`

Quando atualiza o número de um LID para real, não atualiza `canonicalNumber`. Isso pode causar duplicatas futuras (índice único é em canonicalNumber).

```typescript
await lidContact.update({ number: resolution.realNumber });
// FALTA: canonicalNumber: normalizedNumber
```

---

## 2. FindOrCreateTicketService.ts — Erros de Lógica

### 🟠 BUG-4: Condição idêntica duplicada no bloco de campanha

**Arquivo:** `FindOrCreateTicketService.ts:105-109`

```typescript
await ticket.update({
  userId: userId !== ticket.userId ? ticket.userId : userId,
  queueId: queueId !== ticket.queueId ? ticket.queueId : queueId,
})
```

Lógica invertida: quando `userId !== ticket.userId`, mantém `ticket.userId` (o valor atual). Quando `userId === ticket.userId`, atribui `userId` (mesmo valor). **O update é sempre um noop** — nunca muda nada.

**Impacto:** Campanhas que deveriam atribuir fila/atendente ao ticket existente não o fazem.
**Fix:** Inverter a lógica ou simplesmente não fazer update se isCampaign e ticket já existe.

---

### 🟡 BUG-5: Dynamic imports repetidos (performance)

**Arquivo:** `FindOrCreateTicketService.ts:121-123, 268-270, 321, 387, 427-429`

O mesmo arquivo faz `await import("../../models/Queue")` em **5 locais diferentes** no mesmo fluxo. Cada import dinâmico tem overhead.

**Fix:** Importar Queue, Chatbot, Prompt, AIAgent no topo do arquivo.

---

### 🟡 BUG-6: Smart Routing sobrescreve status LGPD/bot

**Arquivo:** `FindOrCreateTicketService.ts:396-399`

```typescript
ticketData.status = (!isImported && !isNil(settings?.enableLGPD) && openAsLGPD) ? "lgpd" : "open";
```

Se `openAsLGPD=false` e a fila tem bot configurado, `initialStatus` era `"bot"` (linha 357), mas o Smart Routing sobrescreve para `"open"`. O bot nunca atende se o dono da carteira estiver online.

**Impacto:** Bot não funciona para contatos com carteira e dono online.

---

### 🟡 BUG-7: timeCreateNewTicket reabre ticket fechado sem verificar LGPD/bot

**Arquivo:** `FindOrCreateTicketService.ts:255-263`

```typescript
if (ticket && ticket.status !== "nps") {
  await ticket.update({
    status: ticket.isGroup ? "group" : "pending",
```

Ticket reaberto pela janela de tempo sempre vai para "pending", ignorando:
- LGPD (deveria ir para "lgpd" se habilitado)
- Bot (deveria ir para "bot" se fila configurada)

---

### 🟡 BUG-8: queueId assignment ignora AIAgent

**Arquivo:** `FindOrCreateTicketService.ts:446-456`

O bloco que atribui fila (linha 424+) verifica chatbot e prompt, mas **NÃO** verifica AIAgent. Isso significa que se a fila tem apenas AIAgent (sem chatbot/prompt), o ticket não entra em modo bot.

---

## 3. UpdateTicketService.ts — Erros de Lógica

### 🔴 BUG-9: Condições duplicadas idênticas (código morto)

**Arquivo:** `UpdateTicketService.ts:439-463` e `587-611`

```typescript
// Linha 439
if (oldUserId !== userId && oldQueueId === queueId && !isNil(oldUserId) && !isNil(userId)) {
  // ...
} else if (oldUserId !== userId && oldQueueId === queueId && !isNil(oldUserId) && !isNil(userId)) {
  // CONDIÇÃO IDÊNTICA — código morto, NUNCA executado
```

A segunda condição é **idêntica** à primeira. O bloco `else if` é código morto. O log `receivedTransfer` nunca é criado para transferências na mesma fila.

**Duplicado em dois locais:** linhas 439-463 (closeOnTransfer) e 587-611 (sem close).

---

### 🟠 BUG-10: Precedência de operador na condição de transferência

**Arquivo:** `UpdateTicketService.ts:507`

```typescript
if (oldQueueId !== queueId || oldUserId !== userId && !isNil(oldQueueId) && !isNil(queueId) && ticket.whatsapp.status === 'CONNECTED') {
```

**Problema:** `&&` tem precedência sobre `||`. A condição real é:
```
(oldQueueId !== queueId) || (oldUserId !== userId && !isNil(oldQueueId) && !isNil(queueId) && CONNECTED)
```

Se `oldQueueId !== queueId` é true, envia mensagem de transferência **mesmo que** `oldQueueId` seja `null`, `queueId` seja `null`, ou whatsapp esteja desconectado.

**Impacto:** Mensagem de transferência enviada quando não deveria. Possível crash se `ticket.whatsapp` for null.
**Fix:** Adicionar parênteses: `(oldQueueId !== queueId || oldUserId !== userId) && !isNil(...)`.

---

### 🟡 BUG-11: console.log de debug em produção

**Arquivo:** `UpdateTicketService.ts:125, 130, 232, 312, 740`

```typescript
console.log(117, "UpdateTicketService - CQRS")
console.log(122, "UpdateTicketService")
console.log(277, "UpdateTicketService - CQRS")
console.log(309, "UpdateTicketService - CQRS")
console.log("erro ao atualizar o ticket", ticketId, "ticketData", ticketData)
```

**Impacto:** Polui stdout em produção. A linha 740 pode logar dados sensíveis (ticketData com nomes de clientes).
**Fix:** Substituir por `logger.debug()` ou remover.

---

### 🟡 BUG-12: Transferência sem close não emite eventos Socket.IO

**Arquivo:** `UpdateTicketService.ts:504-659`

O bloco `else` (transferência SEM closeOnTransfer) não emite `publishTicketDeleted` nem `publishTicketUpdated` antes do return. O fluxo cai no final genérico (linha 721+), mas se o status não mudou, o evento delete pode não ser emitido, e o frontend não move o ticket entre abas.

---

### 🟡 BUG-13: Farewell enviada para grupos mesmo quando deveria não ser

**Arquivo:** `UpdateTicketService.ts:250`

```typescript
if (ticket.channel === "whatsapp" && (!ticket.isGroup || groupAsTicket === "enabled") && ticket.whatsapp.status === 'CONNECTED') {
```

Ticket de grupo com `groupAsTicket === "enabled"` recebe farewell. Mas se o ticket foi fechado por timeout (sem interação humana), enviar farewell em grupo é spam.

---

## 4. queues.ts (Campanhas) — Erros de Lógica

### 🟠 BUG-14: Dupla verificação de supressão

**Arquivo:** `queues.ts:1567` (PrepareContact) e `queues.ts:1722` (DispatchCampaign)

`isNumberSuppressed()` é chamado em **ambos** PrepareContact e DispatchCampaign. Na prepare, o record é criado com `deliveredAt: moment()` — marcando como entregue. Na dispatch, o record já terá `deliveredAt` e será ignorado. Porém o `CampaignShipping.findOrCreate` (linha 1569) pode criar o record ANTES da verificação de supressão retornar.

**Race condition:** Se dois jobs processam o mesmo contato simultaneamente, findOrCreate pode criar o record em paralelo.

---

### 🟡 BUG-15: campaignShipping.status não é verificado em DispatchCampaign

**Arquivo:** `queues.ts:1719`

```typescript
await campaignShipping.update({ status: 'processing' });
```

Não verifica se `campaignShipping.status` já é `delivered`, `failed` ou `suppressed`. Se o job foi reagendado e o record já foi processado por outro job, ele reprocessa.

**Fix:** Verificar status antes de atualizar para "processing".

---

### 🟡 BUG-16: Template params sem escape

**Arquivo:** `queues.ts:1872`

```typescript
templateBodyText = templateBodyText.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
```

O `value` inserido no template pode conter caracteres especiais que afetam o texto final. Não há sanitização do valor.

---

## 5. ContactMergeService.ts — Erros de Lógica

### 🟠 BUG-17: mergeAllDuplicateLids busca por NOME (falso positivo)

**Arquivo:** `ContactMergeService.ts:236-243`

```typescript
const realContact = await Contact.findOne({
  where: {
    name: lidContact.name,  // FALSO POSITIVO: dois "João" diferentes
    remoteJid: { [Op.like]: "%@s.whatsapp.net" },
```

Busca contato real por **nome**, não por número ou LidMapping. Dois contatos com o mesmo nome (ex: "João") seriam mesclados incorretamente, **destruindo dados**.

**Impacto:** 🔴 Perda de dados — tickets e mensagens de um contato vão para outro contato errado.
**Fix:** NUNCA mesclar por nome. Usar LidMapping ou número confirmado.

---

### 🟡 BUG-18: LidJid não é salvo no contato real durante merge

**Arquivo:** `ContactMergeService.ts:119-126`

O comentário diz "Podemos adicionar um campo lidJid no futuro" — mas o campo já existe no modelo Contact. O merge não atualiza `realContact.lidJid`, perdendo a referência reversa.

**Fix:** Adicionar `updateData.lidJid = lidContact.remoteJid` quando é LID.

---

## 6. ReconcilePendingContactsJob.ts — Erros de Lógica

### 🟠 BUG-19: Merge sem transação atômica

**Arquivo:** `ReconcilePendingContactsJob.ts:106-122`

```typescript
const ticketsUpdated = await Ticket.update(...);
const messagesUpdated = await Message.update(...);
await realContact.update({ lidJid });
await pendingContact.destroy();
```

**Sem transação.** Se falhar entre `Message.update` e `pendingContact.destroy()`, o contato pendente permanece, mas seus tickets e mensagens já foram movidos. Resultado: contato fantasma sem dados, impossível de limpar.

O `ContactMergeService` usa transação; este job deveria usar também.

---

### 🟡 BUG-20: Não emite eventos Socket.IO após merge/promoção

**Arquivo:** `ReconcilePendingContactsJob.ts:104-149`

Após mesclar ou promover, nenhum evento Socket.IO é emitido. O frontend continua mostrando o contato antigo (PENDING_xxx) até o próximo refresh.

---

## 7. SocketEventQueue + EventBuses — Problemas

### 🟡 BUG-21: JobId com timestamp pode colidir

**Arquivo:** `socketEventQueue.ts:72`

```typescript
jobId: `${companyId}-${room}-${event}-${Date.now()}`
```

Se dois eventos idênticos são enfileirados no mesmo millisecond (possível em alta carga), o segundo é descartado silenciosamente por duplicata de jobId.

**Fix:** Adicionar UUID ou counter incremental.

---

### 🟡 BUG-22: MessageEventBus onAny sobrescreve emit permanentemente

**Arquivo:** `MessageEventBus.ts:102-110`

```typescript
private onAny(callback): void {
  const originalEmit = this.emit.bind(this);
  this.emit = (eventType, ...args) => {
```

Se `CQRS_DEBUG=true`, o `emit` é sobrescrito **uma vez** durante `setupHandlers()`. Se o debug for desligado em runtime, o wrapper continua ativo.

Além disso: o wrapper causa double-call do callback se `onAny` for chamado duas vezes (improvável, mas defensivamente incorreto).

---

## 8. Frontend TicketsListCustom — Problemas

### 🟠 BUG-23: canViewTicket não filtra por queueId

**Arquivo:** `TicketsListCustom/index.js:297-319`

```javascript
const canViewTicket = (ticket) => {
  // ...
  // NÃO verifica queueId!
  if (_user?.profile === 'admin' && (!_user?.allowedContactTags || ...)) return true;
```

Admin sem `allowedContactTags` vê TODOS os tickets de TODAS as filas, mesmo que `selectedQueueIds` filtre. O `shouldUpdateTicket` filtra por queue, mas `canViewTicket` não — e `canViewTicket` é chamado primeiro.

**Impacto:** Tickets aparecem brevemente antes de serem filtrados por `shouldUpdateTicket`. Flickering visual.

---

### 🟡 BUG-24: Reducer mutação direta do estado

**Arquivo:** `TicketsListCustom/index.js:96-197`

```javascript
if (action.type === "LOAD_TICKETS") {
  newTickets.forEach((ticket) => {
    const ticketIndex = state.findIndex((t) => t.id === ticket.id);
    if (ticketIndex !== -1) {
      state[ticketIndex] = ticket;  // MUTAÇÃO DIRETA do state
      state.unshift(state.splice(ticketIndex, 1)[0]);  // MUTAÇÃO DIRETA
```

O reducer **muta** o array de estado diretamente antes de retornar `[...state]`. Embora funcione na maioria dos casos, viola o contrato do React de imutabilidade e pode causar bugs sutis quando o React otimiza re-renders.

---

### 🟡 BUG-25: Filtro final por status descarta tickets válidos

**Arquivo:** `TicketsListCustom/index.js:468-470`

```javascript
if (status && status !== "search") {
  ticketsList = ticketsList.filter(ticket => ticket.status === status)
}
```

Este filtro roda **a cada render**, após o reducer. Se um ticket muda de status entre dois renders (ex: pending→open), o filtro o remove da lista **antes** que o evento Socket.IO `delete` chegue. O reducer já deveria garantir isso, tornando o filtro redundante — exceto que ele pode causar flickering.

---

## 9. ListContactsService.ts — Vulnerabilidades

### 🟠 BUG-26: SQL Injection via foundationMonths

**Arquivo:** `ListContactsService.ts:328`

```typescript
additionalWhere.push(literal(`EXTRACT(MONTH FROM "foundationDate") IN (${months.join(',')})`));
```

Embora `months` seja filtrado com `Number.isInteger(m)`, se a validação de entrada no controller falhar ou for bypassada, valores maliciosos poderiam ser injetados via `literal()`.

**Fix:** Usar bind parameters ou Sequelize.where() ao invés de literal com interpolação.

---

### 🟠 BUG-27: SQL Injection via creditLimit

**Arquivo:** `ListContactsService.ts:333-341`

```typescript
const creditLimitExpr = literal(`CAST(
  CASE WHEN TRIM("creditLimit") = '' THEN NULL
  WHEN POSITION(',' IN TRIM("creditLimit")) > 0 THEN
    REPLACE(REPLACE(REPLACE(TRIM(REPLACE("creditLimit", 'R$', '')), '.', ''), ',', '.'), ' ', '')
  ELSE REPLACE(TRIM(REPLACE("creditLimit", 'R$', '')), ' ', '')
  END AS NUMERIC
)`);
```

Embora `minCreditLimit/maxCreditLimit` sejam verificados com `typeof === "number"`, o SQL literal complexo é difícil de auditar e pode ter edge cases com valores de creditLimit malformados no banco.

---

### 🟡 BUG-28: Filtro de carteira carrega TODOS os IDs em memória

**Arquivo:** `ListContactsService.ts:85-90`

```typescript
const walletResult = await GetUserWalletContactIds(userId, companyId);
whereCondition.id = { [Op.in]: allowedContactIds };
```

Se um usuário gerencia 50.000 contatos, todos os IDs são carregados em memória e passados como `IN (...)`. PostgreSQL tem limite prático de ~65.000 bind parameters.

**Impacto:** Query falha para carteiras muito grandes.
**Fix:** Usar subquery ao invés de materializar IDs.

---

## 10. ListTicketsService.ts — Vulnerabilidades

### 🟠 BUG-29: Permissão de grupo retorna NENHUM grupo quando allowedGroupContactIds é vazio

**Arquivo:** `ListTicketsService.ts:170-176`

```typescript
if (allowedGroupContactIds.length > 0) {
  whereCondition = { ...whereCondition, contactId: { [Op.in]: allowedGroupContactIds } };
} else {
  // Nenhum grupo liberado → contactId IN [0]
  whereCondition = { ...whereCondition, contactId: { [Op.in]: [0] } };
}
```

Correto para segurança, mas o UX é confuso: usuário com `allowGroup=true` mas sem permissões granulares vê aba "Grupos" vazia sem explicação.

---

## 11. wbotMessageListener.ts — Erros de Lógica

### 🟡 BUG-30: console.log de debug em produção

**Arquivo:** `wbotMessageListener.ts:5028, 5031, 5048`

```typescript
console.log(`[wbotMessageListener] Processando mensagem...`);
console.log(`[wbotMessageListener] Dentro do mutex...`);
console.log(`[wbotMessageListener] Ticket obtido...`);
```

**Fix:** Substituir por `logger.debug()`.

---

### 🟡 BUG-31: Ticket campaign → pending perde unreadMessages anterior

**Arquivo:** `wbotMessageListener.ts:5064-5067`

```typescript
await ticket.update({
  status: newStatus,
  unreadMessages: (ticket.unreadMessages || 0) + 1
});
```

Se o ticket já tinha 5 unread de mensagens de campanha, e o contato responde, o count fica 6. Mas o `FindOrCreateTicketService` anterior (linha 5032) já atualizou `unreadMessages` via seu parâmetro. Pode causar contagem duplicada.

---

## Resumo por Severidade

| Severidade | Qtd | IDs |
|------------|-----|-----|
| 🔴 CRÍTICO | 3 | BUG-1 (banimento), BUG-17 (merge por nome), BUG-19 (merge sem transação) |
| 🟠 ALTO | 8 | BUG-4, BUG-9, BUG-10, BUG-14, BUG-23, BUG-26, BUG-27, BUG-29 |
| 🟡 MÉDIO | 16 | BUG-2, BUG-3, BUG-5, BUG-6, BUG-7, BUG-8, BUG-11, BUG-12, BUG-13, BUG-15, BUG-16, BUG-18, BUG-20, BUG-21, BUG-22, BUG-24, BUG-25, BUG-28, BUG-30, BUG-31 |

## Top 5 — Correções Prioritárias

| # | Bug | Risco | Esforço |
|---|-----|-------|---------|
| 1 | BUG-17: mergeAllDuplicateLids merge por nome | Perda de dados irreversível | Baixo (trocar query) |
| 2 | BUG-1: onWhatsApp() em loop no ResolveLid | Banimento WhatsApp | Baixo (remover fallback) |
| 3 | BUG-19: ReconcileJob sem transação | Contatos fantasma, dados órfãos | Médio (wrap em transaction) |
| 4 | BUG-9/BUG-10: Condições duplicadas/precedência | Logs incorretos, msg indevida | Baixo (fix condições) |
| 5 | BUG-4: Update noop em campanha | Campanhas não atribuem fila | Baixo (fix lógica ternário) |
