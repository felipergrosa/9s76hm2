# FlowBuilder — paridade ManyChat + nós de atendimento/autonomia IA

Data: 2026-10-07. Escopo: tornar o FlowBuilder do 9s76hm2 equivalente ao
Flow Builder do ManyChat + nós extras úteis ao dia a dia de atendimento e a
fluxos autônomos com IA, multicanal (WhatsApp Baileys, WhatsApp Oficial,
Messenger, Instagram).

## 1. Inventário atual (após refatoração 10/2026)

Nós implementados e executados nos dois executores
(`ActionsWebhookService` + `ActionsWebhookFacebookService`):

start, message, singleBlock (texto+img+áudio+vídeo+intervalo), menu,
question (captura variável), interval (segundos), randomizer, condition,
businessHours, tag, webhook, assignUser, internalNote, updateContact,
ticket (fila), end, gotoFlow, openai, typebot, img/audio/video isolados.

Gatilhos existentes: `Whatsapp.flowIdWelcome`, `flowIdNotPhrase`,
`FlowCampaignModel` (palavra-chave exata por conexão), integração de fila
(`QueueIntegrations.type=flowbuilder`), continuação via
`flowStopped`/`lastFlowId`/`flowWebhook`.

## 2. Gap vs. catálogo ManyChat (help.manychat.com, 2026)

| Bloco ManyChat | Status | Ação |
|---|---|---|
| Text | ✅ message/singleBlock | — |
| Image/Audio/Video | ✅ | — |
| **File / PDF** | ⚠️ backend pronto (`SendWhatsAppMediaFlow` roteia application/*→document; Meta aceita `file`) | novo nó `file` + elemento `file` no singleBlock |
| **Smart Delay** (min/horas/dias) | ❌ interval é síncrono e em segundos | nó `smartDelay` + job Bull (`BullScheduler.schedule`) que retoma `ActionsWebhookService` com `nextStage` |
| **Data Collection tipado** | ⚠️ `question` captura texto livre | adicionar `validation` no question (text/email/phone/cpf/number) + reprompt em inválido |
| Card / Gallery (carrossel) | ❌ | Meta: generic template via Graph; Baileys/Oficial: degrade para imagem+texto+botões de menu |
| **Buttons/Quick replies** | ⚠️ menu é texto numerado | Meta: `quick_replies`/`button template` + postback resume; Baileys: buttons removidos do protocolo → manter menu numerado |
| Dynamic block | ⚠️ webhook existe | opção `sendResponseAsMessage` no nó webhook |
| **Start another flow** | ✅ gotoFlow | — |
| **Execute Action** (tag/field/subscribe/notify/open-conversation) | ✅ tag, updateContact, assignUser, internalNote | — |
| **Subscribe/Unsubscribe sequence** | ⚠️ drip existe (DripSequenceEnrollment) | nó `subscribeDrip` (inscreve/desinscrece) |
| **Opt-out** (unsubscribe bot) | ⚠️ DNC por tag + `Contact.disableBot` existem | nó `optOut` (tag DNC + disableBot) |
| **Notify admins** | ⚠️ sem model Notification; sala socket existe | nó `notifyTeam` → emit `company-{id}-notification` |
| Send SMS / Email | ❌ | email: existe `EmailCampaignQueue` — nó `sendEmail` simples; SMS: sem provedor, deferir |
| **AI Step** | ⚠️ openai é prompt único | nó `aiAgent` — transfere o ticket para um AIAgent/funil do sistema |
| **CSAT/NPS** | ⚠️ rating existe no fechamento | nó `csat` — envia pesquisa e marca ticket `nps` |
| **Template Meta (oficial)** | ❌ no builder | nó `sendTemplate` via `SendTemplateToContact` |
| Triggers (keyword/comment/story/ref/ad) | ⚠️ keyword existe via FlowCampaign; comment/story/ref = Fase Meta Automation (doc separado) | motor de regras Meta (pendente) |
| Live chat / pause bot | ⚠️ parcial (disableBot, aba BOT) | nó `waitHuman` — pausa automação até atendente assumir |
| Auto-arrange / zoom UI | ⚠️ zoom existe | auto-arrange (layout dagre) — melhoria UI futura |

## 3. Nós extras para atendimento/autonomia (além do ManyChat)

| Nó | Uso |
|---|---|
| `waitReply` | aguarda resposta com timeout → saída A (respondeu) / B (timeout) — resume via Bull |
| `aiAgent` | ativa um AIAgent+estágio do funil no ticket (IA autônoma assume) |
| `setStatus` | muda status do ticket (open/pending/bot/closed) |
| `csat` | dispara pesquisa de satisfação existente (UserRating) |
| `sendTemplate` | dispara template Meta aprovado (oficial, fora da janela) |
| `subscribeDrip` | inscreve contato em sequência de nutrição |
| `optOut` | descadastra de automações (DNC + disableBot) |
| `notifyTeam` | notificação interna via socket |
| `sendEmail` | dispara e-mail (fila de e-mail já existe) |
| `file` | envia PDF/documento |

## 4. Plano de implementação

### Fase 1 — nós síncronos (sem infra nova)
`file`, `subscribeDrip`, `optOut`, `notifyTeam`, `sendTemplate`, `csat`,
`setStatus`, `aiAgent` (se o vínculo ticket↔agente for simples),
`question.validation` tipado, webhook `sendResponseAsMessage`.

### Fase 2 — agendamento assíncrono
`smartDelay` (min/h/dia) e `waitReply` (timeout): job Bull
`FlowResumeQueue` → `BullScheduler.schedule` → retoma
`ActionsWebhookService(whatsappId, flowStopped, …, nextStage=node alvo)`.
Requer: salvar `nextNode`/`flowId` no ticket ao suspender.

### Fase 3 — canais ricos
Botões/quick replies Meta + postback resume; Card/Gallery Meta;
file no executor Facebook (`sendAttachmentFromUrl` type `file`).

### Fase 4 — gatilhos Meta (complementar à doc ManyChat/IG-FB)
MetaAutomationRule: comment→DM, story mention, ref link, keyword por canal.

## 5. Restrições Meta/plataforma (não burláveis)

- Carrossel/botões reais: só Messenger/IG (WhatsApp oficial usa template;
  Baileys não tem mais buttons) — degradar para menu numerado.
- Smart delay não envia fora da janela de 24h sem template (Meta) — o nó
  deve checar janela e cair para template ou pular.
- Opt-out deve ser respeitado por TODOS os envios (campanha, drip, fluxo).
