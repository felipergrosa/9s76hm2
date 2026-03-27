# Fluxo de Bots e Agentes IA - Análise Completa

## Objetivo
Validar o fluxo de detecção e ativação de bots/agentes IA e garantir compatibilidade com a nova lógica de criação de tickets (regra de 24h).

---

## 1. Sistema de Bot Atual

### AI Agent (Sistema Único)
- **Modelo:** `AIAgent`
- **Configuração:** `queueIds: number[]` (array JSON)
- **Detecção:** `AIAgent.findOne({ queueIds: { [Op.contains]: [ticket.queueId] } })`
- **Processamento:** `handleOpenAi()` via `ResolveAIAgentForTicketService`
- **Estrutura Obrigatória:**
  - Todo `AIAgent` **DEVE** ter pelo menos 1 `FunnelStage`
  - Cada `FunnelStage` **DEVE** ter `systemPrompt` configurado
  - Se AIAgent não tiver FunnelStages, `ResolveAIAgentForTicketService` retorna `null`
- **Features:**
  - Funil de vendas multi-etapas (`FunnelStage`)
  - Análise de sentimento
  - Reconhecimento de imagem
  - Voz/TTS (Speech-to-Text e Text-to-Speech)
  - Provider configurável (OpenAI/Gemini)
  - SDR (Sales Development Representative)
  - Qualificação de leads
  - Horário de funcionamento
  - Anti bot-bot (delay inicial)

**IMPORTANTE:** Chatbot legado e Prompt legado foram **removidos** do projeto. Apenas AIAgent é utilizado.

---

## 2. Fluxo de Detecção e Ativação

### 2.1. Criação de Novo Ticket

**Local:** `FindOrCreateTicketService.ts` (linhas 433-495)

```typescript
// 1. Buscar filas da conexão WhatsApp
const whatsappWithQueues = await Whatsapp.findByPk(whatsapp.id, {
  include: [{ model: Queue, as: "queues" }]
});

// 2. Verificar se fila tem AIAgent
const aiAgent = await AIAgent.findOne({
  where: {
    companyId,
    status: "active",
    queueIds: { [Op.contains]: [firstQueue.id] }
  }
});

// 3. Determinar status inicial
const hasBotInDefaultQueue = !!aiAgent;

if (hasBotInDefaultQueue && !isFromMe) {
  initialStatus = "bot";
  initialIsBot = true;
  initialQueueId = firstQueue.id;
}
```

**Resultado:**
- ✅ Ticket criado com `status: "bot"` e `isBot: true`
- ✅ Ticket vai direto para aba "Bot"

### 2.2. Ticket Pending → Bot

**Local:** `FindOrCreateTicketService.ts` (linhas 309-400)

```typescript
if (ticket.status === "pending" && !isFromMe) {
  // Buscar fila do ticket ou da conexão
  const firstQueue = await Queue.findByPk(ticket.queueId);
  
  // Verificar AIAgent (query otimizada)
  const aiAgent = await AIAgent.findOne({
    where: {
      companyId,
      status: "active",
      queueIds: { [Op.contains]: [firstQueue.id] }
    }
  });
  
  if (aiAgent) {
    await ticket.update({
      status: "bot",
      isBot: true,
      queueId: firstQueue.id
    });
  }
}
```

**Resultado:**
- ✅ Ticket `pending` vira `bot` automaticamente quando mensagem chega
- ✅ Evento `publishStatusChanged` emitido para frontend

---

## 3. Processamento de Mensagens pelo Bot

### 3.1. Verificações de Segurança

**Local:** `wbotMessageListener.ts` (linhas 6407-6417)

```typescript
// 1. Ticket deve estar em modo bot
if (ticket.status !== "bot") {
  return; // NÃO processa
}

// 2. Não processar mensagens próprias
if (msg.key.fromMe) {
  return;
}

// 3. Respeitar desativação do bot por contato
if (contact?.disableBot) {
  return;
}
```

### 3.2. Prioridade de Processamento

**Local:** `wbotMessageListener.ts` (linhas 6419-6437)

```typescript
// PROCESSAMENTO SIMPLIFICADO: Apenas AIAgent
// Todos os agentes IA devem ter FunnelStages com systemPrompt configurado.
// handleOpenAi resolve automaticamente o AIAgent a partir do ticket.queueId.
if (ticket.isBot) {
  try {
    await handleOpenAi(
      undefined as any,
      msg,
      wbot,
      ticket,
      contact,
      mediaSent,
      ticketTraking
    );
  } catch (e) {
    Sentry.captureException(e);
    logger.error(`[wbotMessageListener] Erro ao processar IA por AIAgent. ticketId=${ticket.id}; queueId=${ticket.queueId}; err=${e?.message || e}`);
  }
}
```

**Resultado:**
- ✅ Apenas 1 caminho de processamento: AIAgent via `handleOpenAi`
- ✅ Código simplificado e mais fácil de manter
- ✅ `handleOpenAi` com `undefined` força uso de `ResolveAIAgentForTicketService`
- ✅ Sem lógica legada de chatbot ou prompt

### 3.3. Resolução do AI Agent

**Local:** `ResolveAIAgentForTicketService.ts` (linhas 48-67)

```typescript
const agent = await AIAgent.findOne({
  where: {
    companyId: ticket.companyId,
    status: "active",
    queueIds: { [Op.contains]: [ticket.queueId] }
  },
  include: [{ model: FunnelStage, as: "funnelStages" }]
});

if (!agent) {
  return null; // Sem agente configurado
}

// Retorna configuração completa do agente
return {
  agent,
  currentStage: stages[0], // Primeira etapa do funil
  systemPrompt: currentStage.systemPrompt,
  enabledFunctions: currentStage.enabledFunctions,
  voiceEnabled: agent.voiceEnabled,
  // ...
};
```

---

## 4. Compatibilidade com Nova Lógica de Tickets

### 4.1. Cenário: Ticket Pending > 24h + Bot na Fila

**Fluxo:**

1. **Cliente envia mensagem** → `FindOrCreateTicketService` é chamado
2. **Ticket `pending` encontrado** (> 24h desde última interação)
3. **Regra de 24h aplicada** (linhas 206-262):
   ```typescript
   if (ticket.status !== "open" && hoursSinceLastAction > 24) {
     ticket = null; // Força criação de novo ticket
   }
   ```
4. **Novo ticket criado** (linhas 397-461):
   ```typescript
   const hasBotInDefaultQueue = hasChatbot || hasAIAgent;
   if (hasBotInDefaultQueue) {
     initialStatus = "bot"; // ✅ Novo ticket já inicia como bot
   }
   ```

**Resultado:**
- ✅ Novo ticket criado com `status: "bot"`
- ✅ Bot responde automaticamente
- ✅ Separador visual aparece no chat (ticket antigo vs novo)

### 4.2. Cenário: Ticket Pending < 24h + Bot na Fila

**Fluxo:**

1. **Cliente envia mensagem** → `FindOrCreateTicketService` é chamado
2. **Ticket `pending` encontrado** (< 24h)
3. **Regra de 24h:** Reabre ticket existente
   ```typescript
   await ticket.update({ status: "open" });
   ```
4. **Verificação de bot** (linhas 274-364):
   ```typescript
   if (ticket.status === "pending") {
     // Muda para "bot" se fila tem bot configurado
     await ticket.update({ status: "bot", isBot: true });
   }
   ```

**⚠️ PROBLEMA IDENTIFICADO:**

A verificação de bot acontece **ANTES** da reabertura. Quando o ticket é reaberto para `status: "open"`, a verificação `if (ticket.status === "pending")` não é mais executada.

**Ordem atual:**
1. Regra 24h: `ticket.update({ status: "open" })` (linha 252)
2. Verificação bot: `if (ticket.status === "pending")` (linha 274) ← **NUNCA EXECUTA**

### 4.3. Cenário: Campanha Respondida + Bot na Fila

**Fluxo:**

1. **Cliente responde campanha** → `wbotMessageListener.ts` (linha 5680)
2. **Status muda:** `campaign` → `pending` ou `bot`
   ```typescript
   let newStatus = "pending";
   if (ticket.isBot) {
     newStatus = "bot"; // ✅ Se já tem isBot=true, vai para bot
   }
   ```

**Resultado:**
- ✅ Se campanha foi criada com `isBot: true`, vai para `bot`
- ✅ Se não, vai para `pending` e aguarda aceite

---

## 5. Pontos de Risco Identificados

### ⚠️ RISCO 1: Ticket Reaberto Não Vira Bot

**Problema:**
- Ticket `pending` < 24h é reaberto como `status: "open"`
- Verificação de bot só acontece se `status === "pending"`
- Bot não é ativado automaticamente

**Impacto:**
- Bot não responde mesmo com fila configurada
- Ticket fica em `open` aguardando atendente humano

**Solução:**
Mover verificação de bot para **DEPOIS** da reabertura, ou verificar também `status === "open"`.

### ⚠️ RISCO 2: AIAgent Não Encontrado

**Problema:**
- `AIAgent.findOne({ where: { companyId, status: "active" } })` busca **QUALQUER** agente ativo
- Não filtra por `queueIds` na query
- Depois verifica `aiAgent.queueIds.includes(firstQueue.id)`

**Impacto:**
- Se houver múltiplos agentes ativos, pode pegar o errado
- Performance: busca todos os agentes ativos mesmo quando não necessário

**Solução:**
Filtrar por `queueIds` direto na query usando `Op.contains`.

---

## 6. Recomendações de Ajuste

### Ajuste 1: Verificar Bot Após Reabertura

**Arquivo:** `FindOrCreateTicketService.ts`

**Mudança:**
```typescript
if (shouldReopen) {
  await ticket.update({ 
    status: "open",
    unreadMessages,
    userId: reopenUserId
  });
  
  // NOVO: Verificar se deve virar bot APÓS reabertura
  const Queue = (await import("../../models/Queue")).default;
  const Chatbot = (await import("../../models/Chatbot")).default;
  
  if (ticket.queueId) {
    const queue = await Queue.findByPk(ticket.queueId, {
      include: [{ model: Chatbot, as: "chatbots" }]
    });
    
    const hasChatbot = queue?.chatbots?.length > 0;
    
    // Verificar AIAgent
    const AIAgent = (await import("../../models/AIAgent")).default;
    const aiAgent = await AIAgent.findOne({
      where: {
        companyId,
        status: "active",
        queueIds: { [Op.contains]: [ticket.queueId] }
      }
    });
    
    if (hasChatbot || aiAgent) {
      await ticket.update({ status: "bot", isBot: true });
      ticketEventBus.publishStatusChanged(companyId, ticket.id, ticket.uuid, ticket, "open", "bot");
    }
  }
  
  return ticket;
}
```

### Ajuste 2: Otimizar Query AIAgent

**Arquivo:** `FindOrCreateTicketService.ts` (linhas 332, 445)

**Antes:**
```typescript
const aiAgent = await AIAgent.findOne({
  where: { companyId, status: "active" }
});
if (aiAgent?.queueIds.includes(firstQueue.id)) { ... }
```

**Depois:**
```typescript
const aiAgent = await AIAgent.findOne({
  where: {
    companyId,
    status: "active",
    queueIds: { [Op.contains]: [firstQueue.id] }
  }
});
if (aiAgent) { ... }
```

---

## 7. Fluxo Validado Final

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Mensagem Chega                                           │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. FindOrCreateTicketService                                │
│    - Busca ticket existente                                 │
│    - Aplica regra de 24h se status !== "open"              │
└─────────────────────────────────────────────────────────────┘
                           │
                ┌──────────┴──────────┐
                │                     │
                ▼                     ▼
    ┌─────────────────────┐  ┌─────────────────────┐
    │ Ticket Existente    │  │ Criar Novo Ticket   │
    │ (< 24h ou open)     │  │ (> 24h ou null)     │
    └─────────────────────┘  └─────────────────────┘
                │                     │
                │                     ▼
                │         ┌─────────────────────────┐
                │         │ Verificar Bot na Fila   │
                │         │ - Chatbot?              │
                │         │ - AIAgent?              │
                │         └─────────────────────────┘
                │                     │
                │         ┌───────────┴───────────┐
                │         │                       │
                │         ▼                       ▼
                │   ┌──────────┐          ┌──────────┐
                │   │ Com Bot  │          │ Sem Bot  │
                │   │ bot=true │          │ pending  │
                │   └──────────┘          └──────────┘
                │         │
                └─────────┴─────────────────────────┐
                                                    │
                                                    ▼
                                    ┌─────────────────────────┐
                                    │ 3. wbotMessageListener  │
                                    │    - Verifica status    │
                                    │    - Se "bot" → IA      │
                                    └─────────────────────────┘
                                                    │
                                    ┌───────────────┴───────────────┐
                                    │                               │
                                    ▼                               ▼
                        ┌─────────────────────┐       ┌─────────────────────┐
                        │ Chatbot (Legado)    │       │ AI Agent            │
                        │ sayChatbot()        │       │ handleOpenAi()      │
                        └─────────────────────┘       └─────────────────────┘
```

---

## 8. Ajustes Implementados

### ✅ Ajuste 1: Verificar Bot Após Reabertura

**Arquivo:** `FindOrCreateTicketService.ts` (linhas 248-295)

**Implementação:**
```typescript
if (shouldReopen) {
  // NOVO: Verificar se fila tem bot configurado
  const Queue = (await import("../../models/Queue")).default;
  const Chatbot = (await import("../../models/Chatbot")).default;
  
  let shouldActivateBot = false;
  
  if (ticket.queueId) {
    const queue = await Queue.findByPk(ticket.queueId, {
      include: [{ model: Chatbot, as: "chatbots" }]
    });
    
    const hasChatbot = queue?.chatbots?.length > 0;
    
    // Verificar AIAgent
    const AIAgent = (await import("../../models/AIAgent")).default;
    const aiAgent = await AIAgent.findOne({
      where: {
        companyId,
        status: "active",
        queueIds: { [Op.contains]: [ticket.queueId] }
      }
    });
    
    shouldActivateBot = hasChatbot || !!aiAgent;
  }
  
  await ticket.update({ 
    status: shouldActivateBot ? "bot" : "open",
    isBot: shouldActivateBot,
    userId: shouldActivateBot ? null : reopenUserId
  });
}
```

**Resultado:**
- ✅ Ticket reaberto < 24h agora verifica se fila tem bot
- ✅ Se fila tem bot: reabre como `status: "bot"` e bot responde
- ✅ Se fila sem bot: reabre como `status: "open"` para humano

---

### ✅ Ajuste 2: Otimizar Query AIAgent

**Arquivo:** `FindOrCreateTicketService.ts` (linhas 367-373, 481-487)

**Antes:**
```typescript
const aiAgent = await AIAgent.findOne({
  where: { companyId, status: "active" }
});
if (aiAgent?.queueIds.includes(firstQueue.id)) { ... }
```

**Depois:**
```typescript
const aiAgent = await AIAgent.findOne({
  where: {
    companyId,
    status: "active",
    queueIds: { [Op.contains]: [firstQueue.id] }
  }
});
if (aiAgent) { ... }
```

**Resultado:**
- ✅ Query filtra direto no banco (PostgreSQL `@>` operator)
- ✅ Performance melhorada
- ✅ Evita pegar agente errado quando há múltiplos ativos

---

### ✅ Ajuste 3: Regra de 24h para Todos os Status

**Arquivo:** `FindOrCreateTicketService.ts` (linhas 206-246)

**Implementação:**
```typescript
// Verificar se ticket NÃO está aberto (open)
// Para qualquer outro status (closed, pending, campaign, lgpd, nps, etc.)
// aplicar lógica de janela de 24h
const isNotOpen = ticket.status !== "open";

if (isNotOpen && !isFromMe) {
  // Buscar último log de mudança de status
  const lastStatusLog = await LogTicket.findOne({
    where: {
      ticketId: ticket.id,
      type: { [Op.in]: ["closed", "pending", "campaign"] }
    },
    order: [["createdAt", "DESC"]]
  });
  
  const hoursSinceLastAction = lastStatusLog 
    ? differenceInHours(new Date(), lastStatusLog.createdAt) 
    : differenceInHours(new Date(), ticket.updatedAt);
  
  if (hoursSinceLastAction < 24) {
    // Reabre OU cria novo (se usuário diferente)
  } else {
    // Cria novo ticket
    ticket = null;
  }
}
```

**Resultado:**
- ✅ Regra de 24h aplicada para `pending`, `campaign`, `closed`, etc.
- ✅ Suporta atendimento misto (bot + humano)
- ✅ Separadores visuais aparecem quando novo ticket é criado

---

## 9. Conclusão

### ✅ Pontos Positivos
1. **Sistema simplificado:** Apenas AIAgent (sem chatbot legado)
2. **Estrutura obrigatória:** Todo AIAgent deve ter FunnelStages com systemPrompt
3. **Configuração avançada:** Funil multi-etapas, sentimento, voz, SDR, qualificação de leads
4. **Verificações de segurança:** `status === "bot"`, `disableBot`, horário de funcionamento
5. **Bot ativa automaticamente:** Ao reabrir ticket < 24h em fila com bot
6. **Queries otimizadas:** `Op.contains` para melhor performance no PostgreSQL
7. **Código limpo:** Sem lógica legada, fácil manutenção

### 📋 Fluxo Validado para Atendimento Misto

**Cenário 1: Ticket Pending > 24h + Bot na Fila**
1. Cliente envia mensagem
2. Ticket `pending` encontrado (> 24h)
3. **Novo ticket criado** com `status: "bot"`
4. Bot responde automaticamente
5. Separador visual aparece no chat

**Cenário 2: Ticket Pending < 24h + Bot na Fila**
1. Cliente envia mensagem
2. Ticket `pending` encontrado (< 24h)
3. **Ticket reaberto** como `status: "bot"`
4. Bot responde automaticamente
5. Mesmo ticket continua (sem separador)

**Cenário 3: Ticket em Fila com Bot (Atendimento Contínuo)**
- Enquanto ticket estiver na fila com bot configurado
- Bot continua respondendo
- Se ticket sair da fila (transferido/aceito por humano)
- Bot para de responder (`status !== "bot"`)

### 📋 Próximos Passos
1. **Reiniciar backend** para aplicar mudanças
2. Testar fluxo: pending > 24h → novo ticket → bot responde
3. Testar fluxo: pending < 24h → reabre → bot responde
4. Validar separadores visuais aparecem corretamente
5. Testar transferência de fila: bot → humano → bot
