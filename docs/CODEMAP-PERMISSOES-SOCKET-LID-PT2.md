# CODEMAP — Whaticket: Permissões, Socket.IO e Resolução LID (Parte 2)

> Continuação do codemap principal. Traces 9–17 complementam os 8 traces originais.

---

## Trace 9 — Ciclo de Vida do Ticket (FindOrCreateTicketService)

**Descrição:** Mensagem WhatsApp chega → mutex garante atomicidade → busca ticket existente ou cria novo com status inteligente (bot/pending/group/lgpd)

```
handleMessage() recebe msg do Baileys
└── wbotMessageListener.ts:5030
    └── mutex.runExclusive() ← evita race condition
        └── FindOrCreateTicketService() ← 9a
            │
            ├── É GRUPO?
            │   └── Ticket.findOne(contactId, companyId, isGroup:true) ← 9b
            │       ├── Encontrou → reabrir se closed → return
            │       └── Não → continua para criação
            │
            ├── É DM (contato individual)?
            │   └── Ticket.findOne(status IN [open,pending,group,nps,lgpd,bot,campaign]) ← 9c
            │       ├── Encontrou + pending + !fromMe → verificar bot na fila ← 9d
            │       │   └── Se fila tem chatbot/prompt/AIAgent → update(status:"bot")
            │       └── Não encontrou → timeCreateNewTicket window
            │
            ├── Criação de novo ticket ← 9e
            │   ├── Busca filas da conexão (Whatsapp → Queues → Chatbots/Prompts)
            │   ├── Verifica AIAgent ativo para a fila
            │   ├── Determina status inicial:
            │   │   ├── lgpd (se LGPD habilitado)
            │   │   ├── group (se grupo)
            │   │   ├── bot (se fila tem chatbot/prompt/AIAgent)
            │   │   └── pending (default)
            │   ├── Smart Routing: DirectTicketsToWallets ← 9f
            │   │   └── Se wallet owner ONLINE → status:"open", userId=owner
            │   │   └── Se wallet owner OFFLINE → status:"pending"
            │   └── Ticket.create(ticketData)
            │
            └── return ticket
```

| Location | Título | Descrição | Arquivo:Linha |
|----------|--------|-----------|---------------|
| 9a | Entry: FindOrCreateTicketService | Orquestra busca/criação de ticket | FindOrCreateTicketService.ts:22 |
| 9b | Busca ticket de grupo | Sempre reutiliza ticket existente (1 grupo = 1 ticket) | FindOrCreateTicketService.ts:64 |
| 9c | Busca ticket ativo de DM | Filtra por status ativo + contactId + whatsappId | FindOrCreateTicketService.ts:91 |
| 9d | Verifica bot em ticket pending | Se fila tem chatbot/prompt/AIAgent → muda para "bot" | FindOrCreateTicketService.ts:116 |
| 9e | Criação de novo ticket | Determina status inicial com base na configuração | FindOrCreateTicketService.ts:367 |
| 9f | Smart Routing por carteira | Atribui ticket ao dono da carteira se estiver online | FindOrCreateTicketService.ts:381 |

---

## Trace 10 — Fechamento de Ticket com Despedida/NPS

**Descrição:** Atendente fecha ticket → sistema envia mensagem de despedida OU NPS → TicketEventBus propaga delete para frontend

```
UpdateTicketService({ status: "closed" }) ← 10a
├── SetTicketMessagesAsRead(ticket)
├── Salva oldStatus para propagação
│
├── SE userRating enabled E tem ratingMessage ← 10b
│   ├── SendWhatsAppMessage(ratingMessage) → verifyMessage()
│   ├── ticketTraking.update(closedAt)
│   ├── ticket.update(status: "nps")
│   └── ticketEventBus.publishTicketDeleted(oldStatus) ← 10c
│       └── return (ticket fica em NPS)
│
├── SE tem farewellMessage (usuário OU conexão) ← 10d
│   ├── Seleciona: user.farewellMessage || whatsapp.complationMessage
│   ├── SendWhatsAppMessage(body) → verifyMessage()
│   └── (continua para fechamento)
│
├── ticketTraking.update(finishedAt, closedAt)
├── CreateLogTicketService(type: "closed")
├── ticket.update(status: "closed", lastFlowId: null)
│
└── ticketEventBus.publishTicketDeleted(companyId, ticketId, uuid, oldStatus) ← 10e
    └── EventBus → emitSocketEvent → broadcast namespace
        └── Frontend: TicketsListCustom remove da aba correspondente
```

| Location | Título | Descrição | Arquivo:Linha |
|----------|--------|-----------|---------------|
| 10a | Entry: fecha ticket | UpdateTicketService com status="closed" | UpdateTicketService.ts:161 |
| 10b | Fluxo NPS | Envia ratingMessage, muda para "nps" | UpdateTicketService.ts:169 |
| 10c | Emite delete para NPS | Frontend remove da aba aberta | UpdateTicketService.ts:230 |
| 10d | Mensagem de despedida | user.farewellMessage ou complationMessage | UpdateTicketService.ts:238 |
| 10e | Emite delete final | Broadcast via TicketEventBus | UpdateTicketService.ts:311 |

---

## Trace 11 — Transferência de Ticket entre Filas/Atendentes

**Descrição:** Ticket é transferido → pode criar novo ticket (closeOnTransfer) → envia mensagem automática → propaga via TicketEventBus

```
UpdateTicketService({ isTransfered: true, queueId, userId }) ← 11a
│
├── SE closeTicketOnTransfer === true ← 11b
│   ├── ticket.update(status: "closed")
│   ├── ticketEventBus.publishTicketDeleted(oldStatus)
│   ├── FindOrCreateTicketService(contact, whatsapp, ..., isTransfered: true) ← 11c
│   │   └── Cria novo ticket para a nova fila
│   ├── SE msgTransfer → CreateMessageService(isPrivate: true) ← 11d
│   │   └── Salva nota interna de transferência
│   ├── newTicket.update(queueId, userId, status)
│   └── Enviar mensagem de transferência ao cliente (se habilitado)
│       └── wbot.sendMessage(transferMessage) → verifyMessage()
│
├── SE closeTicketOnTransfer === false
│   ├── SE msgTransfer → CreateMessageService(isPrivate: true)
│   ├── Envia mensagem de transferência (se habilitado)
│   └── Mantém mesmo ticket, apenas muda fila/atendente
│
├── CreateLogTicketService(type: "transfered" / "receivedTransfer")
│
├── ticketEventBus.publishTicketDeleted(companyId, ticketId, uuid, oldStatus) ← 11e
└── ticketEventBus.publishTicketUpdated(companyId, ticketId, uuid, ticket) ← 11f
    │
    └── ApplyUserPersonalTagService ← 11g
        └── Aplica tag pessoal (#) do novo atendente ao contato
```

| Location | Título | Descrição | Arquivo:Linha |
|----------|--------|-----------|---------------|
| 11a | Entry: transferência | isTransfered=true no UpdateTicketService | UpdateTicketService.ts:321 |
| 11b | Close on transfer | Fecha ticket original e cria novo | UpdateTicketService.ts:322 |
| 11c | Cria novo ticket | FindOrCreateTicketService para nova fila | UpdateTicketService.ts:334 |
| 11d | Nota interna | Mensagem privada com motivo da transferência | UpdateTicketService.ts:348 |
| 11e | Delete oldStatus | Remove da aba anterior | UpdateTicketService.ts:496 |
| 11f | Update newTicket | Adiciona na aba nova | UpdateTicketService.ts:500 |
| 11g | Auto-tag pessoal | Aplica tag do novo atendente | UpdateTicketService.ts:731 |

---

## Trace 12 — Pipeline de Campanha (PrepareContact → DispatchCampaign)

**Descrição:** Campanha enfileira contatos → prepara mensagem com variáveis → verifica supressão → aplica cap/backoff/pacing → envia via Baileys ou API Oficial

```
campaignQueue.process("PrepareContact") ← 12a
├── getCampaign(campaignId) ou usa campaignData do job
├── getContact(contactId)
├── Enriquecer contato com dados do CRM (Contact.findOne)
├── getProcessedMessage(message, variables, enrichedContact) ← 12b
│   └── Substitui variáveis: {{name}}, {{number}}, etc.
├── isNumberSuppressed(number, companyId) ← 12c
│   └── Se suprimido → update(status:"suppressed") → return
├── CampaignShipping.findOrCreate ← 12d
│   └── Se já entregue/failed/suppressed → return (idempotência)
├── Seleciona conexão:
│   ├── round_robin → pickNextWhatsapp(campaign) ← 12e
│   └── default → campaign.whatsappId
└── campaignQueue.add("DispatchCampaign", { delay }) ← 12f

campaignQueue.process("DispatchCampaign") ← 12g
├── Verifica campaign.status === "EM_ANDAMENTO"
├── GetWhatsappWbot(whatsapp) ou API Oficial
├── CampaignShipping.findByPk (com ContactListItem)
├── campaignShipping.update(status: "processing")
├── Verificação anti-ban: ← 12h
│   ├── getCapDeferDelayMs(whatsappId) → cap horário/diário
│   ├── getBackoffDeferDelayMs(whatsappId) → backoff em erros
│   └── getPacingDeferDelayMs(whatsappId) → intervalo entre msgs
│   └── SE deferMs > 0 → reagenda com delay → return
│
├── API Oficial com Template Meta: ← 12i
│   ├── Contact.findOrCreate
│   ├── GetTemplateDefinition → MapTemplateParameters
│   ├── getUserIdByContactTags (distribuição por tags)
│   ├── FindOrCreateTicketService(isCampaign: true)
│   ├── ticket.update(status: "campaign")
│   └── sendOfficialTemplateMessage
│
└── Baileys (não oficial):
    └── wbot.sendMessage → verifyMessage → persist
```

| Location | Título | Descrição | Arquivo:Linha |
|----------|--------|-----------|---------------|
| 12a | PrepareContact entry | Prepara dados do contato para envio | queues.ts:1492 |
| 12b | Processa variáveis | Substitui {{name}}, {{number}}, etc. | queues.ts:1536 |
| 12c | Verifica supressão | Opt-out / blacklist | queues.ts:1567 |
| 12d | Idempotência | findOrCreate evita reenvio | queues.ts:1569 |
| 12e | Round robin | Seleciona conexão por rodízio | queues.ts:1611 |
| 12f | Enfileira dispatch | Agenda envio com delay | queues.ts:1614 |
| 12g | DispatchCampaign entry | Executa o envio real | queues.ts:1638 |
| 12h | Anti-ban: cap/backoff/pacing | Controle de limites por conexão | queues.ts:1737 |
| 12i | API Oficial com template | Envia via Meta API + cria ticket campaign | queues.ts:1784 |

---

## Trace 13 — MessageEventBus (CQRS para Mensagens)

**Descrição:** Singleton EventEmitter que desacopla persistência de mensagens da emissão Socket.IO. Todos os eventos de mensagem passam por aqui.

```
MessageEventBus (Singleton) ← 13a
├── Eventos suportados:
│   ├── MESSAGE_CREATED ← 13b
│   │   └── emitSocketEvent(companyId, ticketUuid, appMessage, {action:"create"})
│   ├── MESSAGE_UPDATED ← 13c
│   │   └── emitSocketEvent(companyId, ticketUuid, appMessage, {action:"update"})
│   ├── MESSAGE_DELETED
│   │   └── emitSocketEvent(companyId, ticketUuid, appMessage, {action:"delete"})
│   └── MESSAGE_ACK_UPDATED
│       └── emitSocketEvent(companyId, ticketUuid, appMessage, {action:"update"})
│
├── Publicadores (quem chama):
│   ├── CreateMessageService → publishMessageCreated() ← 13d
│   ├── wbotMessageListener (edição) → publishMessageUpdated()
│   ├── wbotMessageListener (reação delete) → publishMessageDeleted()
│   ├── MessageController.edit → publishMessageUpdated()
│   └── MessageController.pinMessage → publishMessageUpdated()
│
└── Destino final: emitSocketEvent()
    ├── SE SOCKET_USE_QUEUE=true → Bull Redis queue ← 13e
    └── SE não → emitToCompanyRoom() direto ← 13f
        ├── ns.to(ticketUuid).emit() → sala específica
        └── ns.emit() → broadcast fallback (se appMessage)
```

| Location | Título | Descrição | Arquivo:Linha |
|----------|--------|-----------|---------------|
| 13a | Singleton MessageEventBus | Instância única via getInstance() | MessageEventBus.ts:27 |
| 13b | Handler MESSAGE_CREATED | Emite create para sala UUID | MessageEventBus.ts:37 |
| 13c | Handler MESSAGE_UPDATED | Emite update para sala UUID | MessageEventBus.ts:50 |
| 13d | CreateMessageService publica | Após persistir no banco | CreateMessageService.ts:149 |
| 13e | Fila Redis (Bull) | Garante entrega com retry | socketEventQueue.ts:91 |
| 13f | Emissão direta | emitToCompanyRoom sem fila | socketEventQueue.ts:94 |

---

## Trace 14 — SocketEventQueue (Fila Redis Persistente)

**Descrição:** Fila Bull/Redis que garante entrega de eventos Socket.IO com retry exponencial, mesmo em caso de falhas

```
emitSocketEvent(companyId, room, event, payload) ← 14a
│
├── SE SOCKET_USE_QUEUE=true ← 14b
│   └── queueSocketEvent() ← 14c
│       └── socketEventQueue.add(data, { priority, jobId })
│           └── Bull Redis queue (FIFO com prioridade)
│               └── Worker process() ← 14d
│                   └── emitToCompanyRoom(companyId, room, event, payload)
│                       ├── io.of(/workspace-${companyId})
│                       ├── ns.to(room).emit() — sala específica
│                       └── ns.emit() — broadcast (se appMessage)
│
├── SE SOCKET_USE_QUEUE=false (padrão) ← 14e
│   └── emitToCompanyRoom() direto
│
├── Retry automático: ← 14f
│   └── 5 tentativas, backoff exponencial (1s, 2s, 4s, 8s, 16s)
│
├── Monitoramento:
│   ├── completed → log debug
│   ├── failed → log warn com tentativas
│   └── stalled → log warn + reprocessamento
│
└── Manutenção:
    └── cleanOldJobs() → limpa completed (24h) e failed (7d)
```

| Location | Título | Descrição | Arquivo:Linha |
|----------|--------|-----------|---------------|
| 14a | Entry: emitSocketEvent | Decide entre fila ou direto | socketEventQueue.ts:84 |
| 14b | Verifica SOCKET_USE_QUEUE | Env var controla modo | socketEventQueue.ts:91 |
| 14c | Enfileira evento | Bull queue com jobId único | socketEventQueue.ts:60 |
| 14d | Worker processa | Desempilha e emite via Socket.IO | socketEventQueue.ts:31 |
| 14e | Emissão direta | Bypass da fila (padrão) | socketEventQueue.ts:94 |
| 14f | Retry config | 5 tentativas, backoff exponencial | socketEventQueue.ts:20 |

---

## Trace 15 — Frontend TicketsListCustom (Handlers de Socket)

**Descrição:** Componente React que escuta eventos Socket.IO e atualiza a lista de tickets em tempo real usando useReducer

```
TicketsListCustom (React Component) ← 15a
│
├── Estado gerenciado por useReducer:
│   ├── LOAD_TICKETS — carrega do backend (paginado)
│   ├── UPDATE_TICKET — adiciona/atualiza ticket na lista
│   ├── UPDATE_TICKET_UNREAD_MESSAGES — move para topo
│   ├── UPDATE_TICKET_CONTACT — atualiza dados do contato
│   ├── DELETE_TICKET — remove ticket da lista
│   └── RESET — limpa estado
│
├── Refs para evitar stale closures: ← 15b
│   ├── userRef, selectedQueueIdsRef, showAllRef
│   ├── showTicketWithoutQueueRef, sortTicketsRef
│   └── Atualizados a cada render (useEffect sem deps)
│
├── useEffect de Socket [status, companyId, socket]: ← 15c
│   │
│   ├── canViewTicket(ticket) ← 15d
│   │   ├── Admin + showAll → vê tudo
│   │   ├── Ticket em atendimento → só userId === myId
│   │   └── allowedContactTags → filtra por tags do contato
│   │
│   ├── shouldUpdateTicket(ticket)
│   │   └── canViewTicket + filtro por queueIds selecionadas
│   │
│   ├── on("company-{companyId}-ticket") ← 15e
│   │   ├── action: "create" → UPDATE_TICKET (se status match)
│   │   ├── action: "update" → UPDATE_TICKET ou DELETE_TICKET
│   │   │   └── Se ticket.status !== status da aba → DELETE
│   │   ├── action: "delete" → DELETE_TICKET ← 15f
│   │   │   └── Filtra por oldStatus (só remove da aba certa)
│   │   └── action: "updateUnread" → RESET_UNREAD
│   │
│   ├── on("company-{companyId}-appMessage") ← 15g
│   │   └── action: "create" → UPDATE_TICKET_UNREAD_MESSAGES
│   │       └── Move ticket para topo da lista
│   │
│   └── on("company-{companyId}-contact")
│       └── action: "update" → UPDATE_TICKET_CONTACT
│
└── Filtro final: ticketsList.filter(t => t.status === status) ← 15h
```

| Location | Título | Descrição | Arquivo:Linha |
|----------|--------|-----------|---------------|
| 15a | Componente TicketsListCustom | Lista de tickets com Socket.IO | TicketsListCustom/index.js:199 |
| 15b | Refs para stale closures | Evita re-registro de handlers | TicketsListCustom/index.js:229 |
| 15c | useEffect de Socket | Deps mínimas: [status, companyId, socket] | TicketsListCustom/index.js:292 |
| 15d | canViewTicket | Filtro de visibilidade por permissões/tags | TicketsListCustom/index.js:297 |
| 15e | Handler ticket event | Processa create/update/delete | TicketsListCustom/index.js:328 |
| 15f | Delete com oldStatus | Só remove da aba correspondente | TicketsListCustom/index.js:376 |
| 15g | Handler appMessage | Atualiza badge de não lidas | TicketsListCustom/index.js:389 |
| 15h | Filtro final por status | Garante consistência da aba | TicketsListCustom/index.js:469 |

---

## Trace 16 — ContactMergeService + ReconcilePendingContactsJob

**Descrição:** Dois mecanismos de fusão de contatos: (1) merge direto LID→Real com transação atômica, (2) job periódico que reconcilia contatos PENDING_

```
═══ MERGE DIRETO (ContactMergeService) ═══

mergeContacts(lidContactId, realContactId, companyId) ← 16a
├── transaction = sequelize.transaction()
├── Validações: ambos existem, nenhum é grupo
│
├── 1. Ticket.update(contactId → realContactId) ← 16b
├── 2. Message.update(contactId → realContactId) ← 16c
├── 3. Tags: findOrCreate para cada tag (sem duplicar) ← 16d
├── 4. Copiar nome/avatar se real não tem
├── 5. ContactTag.destroy(lidContactId)
├── 6. Contact.destroy(lidContactId) ← 16e
│
├── transaction.commit()
│
└── Socket.IO: ← 16f
    ├── emit("contact", action:"delete", lidContactId)
    └── emit("contact", action:"update", realContact)

═══ RECONCILIAÇÃO PERIÓDICA (ReconcilePendingContactsJob) ═══

reconcilePendingContacts(companyId) ← 16g
├── Contact.findAll(number LIKE "PENDING_%") ← 16h
│
├── Para cada contato pendente:
│   ├── LidMapping.findOne(lid, companyId) ← 16i
│   │   └── Se não encontrou → permanece pendente
│   │
│   ├── SE já existe contato real com mesmo número:
│   │   ├── MERGE: Ticket.update + Message.update ← 16j
│   │   ├── Atualizar lidJid do contato real
│   │   └── pendingContact.destroy()
│   │
│   └── SE não existe contato real:
│       └── PROMOVER: pendingContact.update({ ← 16k
│           number: normalizedNumber,
│           canonicalNumber: normalizedNumber,
│           remoteJid: "${number}@s.whatsapp.net",
│           lidJid
│       })
│
└── Resultado: { totalPending, reconciled, merged, promoted, failed, remaining }
```

| Location | Título | Descrição | Arquivo:Linha |
|----------|--------|-----------|---------------|
| 16a | Entry: mergeContacts | Merge atômico com transação | ContactMergeService.ts:35 |
| 16b | Transfere tickets | UPDATE Tickets SET contactId | ContactMergeService.ts:81 |
| 16c | Transfere mensagens | UPDATE Messages SET contactId | ContactMergeService.ts:87 |
| 16d | Copia tags sem duplicar | findOrCreate para cada tag | ContactMergeService.ts:93 |
| 16e | Remove contato LID | DELETE após transferir tudo | ContactMergeService.ts:149 |
| 16f | Notifica frontend | Socket.IO delete + update | ContactMergeService.ts:166 |
| 16g | Entry: reconciliação | Job periódico (60s interval) | ReconcilePendingContactsJob.ts:33 |
| 16h | Busca PENDING_ | Contatos sem número real | ReconcilePendingContactsJob.ts:47 |
| 16i | Consulta LidMapping | Cache persistente LID→PN | ReconcilePendingContactsJob.ts:77 |
| 16j | Merge em contato real | Transfere tickets+msgs, destroy pending | ReconcilePendingContactsJob.ts:106 |
| 16k | Promove pendente | Atualiza number/canonical/remoteJid | ReconcilePendingContactsJob.ts:135 |

---

## Trace 17 — Filtro de Contatos por Tags Hierárquicas + Carteira

**Descrição:** ListContactsService aplica filtros em camadas: carteira → tags pessoais bloqueadas → tags permitidas. Garante segregação por vendedor.

```
ListContactsService({ userId, allowedContactTags, ... }) ← 17a
│
├── CAMADA 1: Carteira (Wallet) ← 17b
│   └── GetUserWalletContactIds(userId, companyId)
│       ├── hasWalletRestriction → WHERE id IN (contactIds)
│       └── excludedUserIds → (usuários bloqueados)
│
├── CAMADA 2: Exclusão de tags pessoais bloqueadas ← 17c
│   ├── User.findAll(excludedUserIds) → allowedContactTags
│   ├── Tag.findAll(name LIKE "#%" AND NOT LIKE "##%") ← tags pessoais
│   ├── ContactTag.findAll(tagId IN blockedPersonalTagIds) → contactIds
│   └── WHERE id NOT IN (blockedContactIds)
│       └── Intersecção com filtro anterior (se existir)
│
├── CAMADA 3: Tags permitidas do usuário ← 17d
│   ├── Tag.findAll(id IN allowedContactTags)
│   ├── ContactTag.findAll(tagId IN allowedTagIds) → contactIds
│   └── WHERE id IN (allowedContactIds)
│       └── Intersecção com filtro anterior
│
├── Filtros adicionais (opcionais):
│   ├── dtUltCompra (range de datas)
│   ├── creditLimit (min/max)
│   ├── segment, city, situation, representativeCode
│   ├── empresa, isWhatsappValid
│   └── walletIds, whatsappIds
│
└── Contact.findAll({ where: whereCondition }) ← 17e
    └── Retorna apenas contatos visíveis para o usuário
```

| Location | Título | Descrição | Arquivo:Linha |
|----------|--------|-----------|---------------|
| 17a | Entry: ListContactsService | Recebe userId + allowedContactTags | ListContactsService.ts:51 |
| 17b | Filtro por carteira | GetUserWalletContactIds determina IDs visíveis | ListContactsService.ts:85 |
| 17c | Exclusão de tags bloqueadas | Remove contatos de vendedores bloqueados | ListContactsService.ts:93 |
| 17d | Tags permitidas | Intersecção com tags do usuário | ListContactsService.ts:155 |
| 17e | Query final | findAll com WHERE combinado | ListContactsService.ts:~350 |

---

## Resumo dos Traces

| # | Sistema | Fluxo | Arquivo Principal |
|---|---------|-------|-------------------|
| 1 | Permissões | Atribuição de grupos a usuário | UpdateUserGroupPermissionsService.ts |
| 2 | Permissões | Filtro de grupos na aba Grupos | ListTicketsService.ts |
| 3 | Socket.IO | Mensagem WhatsApp até Socket.IO | wbotMessageListener.ts → CreateMessageService.ts |
| 4 | Socket.IO | Reabertura de ticket via EventBus | wbotMessageListener.ts → TicketEventBus.ts |
| 5 | Socket.IO | Edição de mensagem em tempo real | wbotMessageListener.ts → MessageEventBus.ts |
| 6 | Resolução LID | Extração e resolução de identificadores | ContactResolverService.ts |
| 7 | Resolução LID | Criação de contato pendente | createContact.ts |
| 8 | Resolução LID | Sincronização de participantes de grupo | GetGroupParticipantsService.ts |
| **9** | **Tickets** | **Ciclo de vida do ticket (FindOrCreate)** | **FindOrCreateTicketService.ts** |
| **10** | **Tickets** | **Fechamento com despedida/NPS** | **UpdateTicketService.ts** |
| **11** | **Tickets** | **Transferência entre filas/atendentes** | **UpdateTicketService.ts** |
| **12** | **Campanhas** | **Pipeline PrepareContact → Dispatch** | **queues.ts** |
| **13** | **Socket.IO** | **MessageEventBus (CQRS)** | **MessageEventBus.ts** |
| **14** | **Socket.IO** | **SocketEventQueue (Redis)** | **socketEventQueue.ts** |
| **15** | **Frontend** | **TicketsListCustom handlers** | **TicketsListCustom/index.js** |
| **16** | **Resolução LID** | **Merge + Reconciliação de pendentes** | **ContactMergeService.ts + ReconcilePendingContactsJob.ts** |
| **17** | **Permissões** | **Filtro de contatos por tags/carteira** | **ListContactsService.ts** |
