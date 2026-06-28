# Análise: o que aproveitar do Twenty CRM (twentyhq/twenty) para o Whaticket

> Investigação de viabilidade — não é um plano aprovado para execução, é material de referência para decidir prioridades futuras.

## 1. Resumo executivo

O Twenty é um CRM open-source (MIT) com stack **NestJS + GraphQL + PostgreSQL + Nx** no backend e **React + Jotai + Linaria** no frontend — totalmente diferente da stack do Whaticket (**Express + Sequelize + REST**, **React 17 + MUI/CRA**). **Portar código é inviável**: o custo de adaptação seria maior que reescrever do zero, e os paradigmas (schema dinâmico via GraphQL vs. modelos Sequelize fixos) não se encaixam.

O que vale é **furtar arquitetura, não código**. E a descoberta mais importante da investigação: **o Whaticket atual já implementou, de forma própria, versões de praticamente tudo que o Twenty oferece** (custom fields, permissões por grupo, flow builder, AI agents com funil/SDR, audit log). O ganho real não é "copiar feature nova", é **olhar como o Twenty resolveu os mesmos problemas de forma mais genérica/robusta** e usar isso para evoluir o que já existe, sem refazer.

## 2. Twenty: stack e conceitos-chave

| Item | Twenty |
|---|---|
| Backend | NestJS + GraphQL |
| Banco | PostgreSQL |
| Filas | BullMQ + Redis |
| Monorepo | Nx |
| Frontend | React + TypeScript + Jotai (state) + Linaria (CSS) |
| Licença | MIT |
| Diferencial | Engine de metadados que gera objetos/campos customizados e expõe via GraphQL dinamicamente |

Docs usadas como fonte: `docs.twenty.com/user-guide/data-model`, `/workflows`, `/permissions-access`, `/ai`, `/calendar-emails`, `/developers/self-host`.

## 3. Comparação ponto a ponto

### 3.1 Objetos e campos customizáveis

**Twenty:** sistema de metadados onde o usuário cria **objetos** (entidades, ex: "Projetos") e **campos tipados** (text, number, date, select, multi-select, **relation**) via UI, sem deploy. Campos de relação evitam duplicação ("não crie Produto1/Produto2/Produto3, crie um objeto Produto e relacione"). Isso é regenerado dinamicamente no schema GraphQL.

**Whaticket hoje:** [ContactCustomField.ts](backend/src/models/ContactCustomField.ts) é um EAV simples — `name` + `value` (string), sem tipo, sem validação, sem suporte a relação. Funciona, mas:
- Não dá pra saber se um campo é número, data ou select sem lógica no frontend.
- Não há objeto customizado nenhum — só campos extras em Contact.
- Sem isso, qualquer "select com opções fixas" customizado vira texto livre sujeito a erro de digitação.

**Gap real:** falta **tipagem** no campo customizado, não falta o conceito (esse já existe).

**Recomendação concreta (esforço baixo-médio):**
- Adicionar `type` (enum: text/number/date/select/boolean) e `options` (JSON, para `select`) em `ContactCustomField`.
- Validar no backend conforme o tipo antes de salvar.
- Não vale criar um sistema de "objetos customizados" genérico — não há demanda hoje para entidades novas além de Contact/Ticket, e isso aproximaria do nível de complexidade do Twenty sem necessidade.

### 3.2 Workflow / automação

**Twenty:** motor de workflow com **triggers** (criação/atualização/exclusão de registro, agendado, webhook, manual) → **ações encadeadas** (criar/atualizar/deletar registro, enviar e-mail, HTTP request, código JS, delay, iterator/loop, branch condicional) → **versionamento** e botão de teste antes de ativar.

**Whaticket hoje:** [FlowBuilder.ts](backend/src/models/FlowBuilder.ts) guarda o fluxo inteiro como um blob JSON (`flow`) editado visualmente com `reactflow` (ver [pages/FlowBuilder](frontend/src/pages/FlowBuilder)), com nós dedicados por componente: `FlowBuilderAddTextModal`, `FlowBuilderConditionModal`, `FlowBuilderIntervalModal`, `FlowBuilderMenuModal`, `FlowBuilderRandomizerModal`, `FlowBuilderAddTicketModal`, etc.

Isso já cobre: ações sequenciais, condicionais, delay (`Interval`), randomizer. **O que falta comparado ao Twenty:**
- **Não há versionamento** — editar um fluxo ativo sobrescreve direto, sem histórico nem "modo teste" isolado da produção.
- **Triggers limitados** — hoje o gatilho é essencialmente "mensagem recebida no WhatsApp". Não há trigger por "ticket atualizado", "tag aplicada" ou webhook genérico de entrada.
- **Sem log de execução estruturado** (Twenty tem "workflow runs" — histórico de cada execução com resultado de cada step).

**Recomendação concreta (esforço médio):**
- Adicionar `version` + `isDraft`/`publishedFlow` em `FlowBuilder` para permitir editar sem afetar produção até publicar — resolve o ponto mais arriscado hoje (editar fluxo ativo em produção).
- Criar uma tabela `FlowExecutionLog` (ticketId, flowId, nodeId, status, timestamp) pra dar visibilidade de onde um atendimento "travou" no fluxo — hoje isso provavelmente só é debugável via log de aplicação.
- Não vale generalizar triggers para "qualquer evento de qualquer entidade" (isso é o salto para o nível Twenty/NestJS-GraphQL) — o caso de uso aqui é conversacional, não CRM genérico.

### 3.3 Permissões / RBAC

**Twenty:** hierarquia em 3 camadas — **baseline** (default workspace-wide) → **override por objeto** → **override por campo**, sendo que a regra mais específica vence. Roles se aplicam a usuários, API keys *e agentes de IA*. Tem "row-level permissions" (filtro dinâmico por registro) como feature premium.

**Whaticket hoje:** [UserGroupPermission.ts](backend/src/models/UserGroupPermission.ts) é **por contato específico** (user × contact × company) — não é uma hierarquia de roles, é uma ACL pontual. Tem também `GroupPermissionSelector`, `PermissionTransferList` e `usePermissions.js` no frontend, e [ticketPreviewPermissions.js](frontend/src/utils/ticketPreviewPermissions.js) sugere já existir lógica de "o que cada user pode ver" no nível de ticket.

**Gap real:** não existe uma camada de **role com permissões granulares por objeto/campo** — hoje permissão é "fulano pode ver o contato X" (linha a linha), não "fulano pode editar o campo Y de qualquer Contact".

**Recomendação concreta (esforço médio-alto, mas alto valor se o produto crescer multi-empresa):**
- Modelar `Role` com permissões por recurso (`Ticket`, `Contact`, `Campaign`, ...) e por ação (`view`, `edit`, `delete`), separado da ACL pontual por contato que já existe (as duas coisas podem coexistir: role = baseline, ACL por contato = override pontual — exatamente o padrão "baseline → override" do Twenty).
- Como o sistema já tem `AIAgent`, vale aplicar a ideia de "permissão também se aplica a agentes de IA" — hoje o `AIAgent` provavelmente herda acesso irrestrito às filas configuradas; explicitar isso como uma permissão revisável evita um agente de IA acessar dado que um humano não acessaria.

### 3.4 AI Agents

**Twenty:** feature em **beta**, ainda limitada — agente plugável a um workflow, com prompt customizado, para enriquecimento/classificação/resumo, respeitando RBAC.

**Whaticket hoje:** isso aqui é o ponto onde o Whaticket está **mais maduro que o Twenty**, não o contrário. [AIAgent.ts](backend/src/models/AIAgent.ts) já tem: perfis (sales/support/service/hybrid), funil de estágios ([FunnelStage.ts](backend/src/models/FunnelStage.ts) com `systemPrompt`, `tone`, `autoAdvanceCondition`, `sentimentThreshold` por etapa), módulo de **SDR completo** (ICP, metodologia BANT/SPIN/GPCT, scoring, gatilhos de transferência, agendamento), horário de funcionamento, qualificação de lead com mapeamento de campos, anti-bot/anti-loop, TTS/STT. Há ainda `AIAuditLog`, `AITestResult`, `AITestScenario`, `AITrainingFeedback`, `KnowledgeChunk`/`KnowledgeDocument` (RAG) e `Skill`.

**Recomendação:** nada a importar do Twenty aqui. Se algo, é o **inverso**: a única ideia do Twenty aplicável é formalizar que permissões de role (3.3) também restrinjam o que cada `AIAgent`/`Skill` pode acessar — o resto já existe e é mais sofisticado no Whaticket.

### 3.5 Timeline / atividade por registro

**Twenty:** e-mails/eventos de calendário se anexam automaticamente à timeline de People/Company/Opportunity (por matching de e-mail/domínio). **Não é genérico** — o próprio Twenty admite que custom objects não têm isso ainda.

**Whaticket hoje:** [AuditLog.ts](backend/src/models/AuditLog.ts) já é genérico por design — `entity` + `entityId` + `action` + `details` (JSON). Isso é estruturalmente equivalente (e mais flexível) do que o que o Twenty tem hoje para objetos customizados.

**Recomendação (esforço baixo):** o gap não é de modelo de dados, é de **UI** — se não existe uma tela de "timeline" que lê `AuditLog` filtrado por `entity=Contact&entityId=X` e mistura com mensagens/tickets daquele contato, isso é a única coisa que vale construir, reaproveitando o que já existe.

### 3.6 Self-hosting / containers

Não há gap relevante aqui — a arquitetura do Twenty (Postgres + Redis + server + worker) é estruturalmente igual à do Whaticket (Postgres/MySQL + Redis + backend + filas via Bull). Nada novo a aprender.

## 4. Plano de ação sugerido (se decidirem seguir)

> Todos os itens abaixo são **aditivos**: campos/tabelas novos, nunca alteração do que já existe. Dados e fluxos já em produção continuam funcionando sem migração forçada — `type`/`version` novos só passam a ter valor para registros criados/editados depois da mudança.

**Quick wins (baixo esforço, baixo risco):**
1. Tipar `ContactCustomField` (`type` + `options`) — §3.1.
2. Tela de timeline por contato/ticket lendo `AuditLog` — §3.5.

**Médio prazo (esforço médio, valor claro):**
3. Versionar `FlowBuilder` (draft vs. publicado) + log de execução — §3.2. Hoje editar um fluxo em produção é arriscado; isso resolve o maior risco operacional identificado. Fluxos existentes (sem o campo novo) devem ser tratados como já "publicados" por padrão — continuam rodando exatamente como hoje até alguém abrir e editar.

**Maior investimento (avaliar demanda antes de iniciar):**
4. Camada de `Role` com permissões por recurso/ação, coexistindo com a ACL por contato atual — §3.3. Só compensa se o produto for vender para múltiplas empresas com equipes maiores/times com papéis distintos.

## 5. O que não vale a pena

- Migrar de REST/Sequelize para GraphQL/NestJS só por causa do Twenty — sem ganho mensurável para o caso de uso de atendimento via WhatsApp.
- Criar um sistema genérico de "objetos customizáveis" (estilo Twenty) — não há demanda por entidades novas, só por campos tipados em Contact/Ticket.
- Tentar reaproveitar AI Agents do Twenty — está em beta e é mais simples que o que o Whaticket já tem.
- Reusar componentes de UI do Twenty (Jotai/Linaria incompatíveis com MUI/styled-components já em uso).

## 6. Referências consultadas

- https://github.com/twentyhq/twenty
- https://docs.twenty.com/user-guide/data-model/overview
- https://docs.twenty.com/user-guide/workflows/overview
- https://docs.twenty.com/user-guide/permissions-access/capabilities/permissions
- https://docs.twenty.com/user-guide/ai/capabilities/ai-agents
- https://docs.twenty.com/developers/self-host/capabilities/docker-compose
- https://docs.twenty.com/user-guide/calendar-emails/how-tos/can-i-track-email-activity-on-all-objects
