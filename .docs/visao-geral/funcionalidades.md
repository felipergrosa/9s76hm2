## Funcionalidades do Taktchat

Este documento consolida as principais capacidades da plataforma considerando o código atual (frontend React, backend Node/TypeScript) e os fluxos descritos nos demais arquivos de `.docs/`.

### 1. Atendimento omnichannel
- **Tickets em tempo real**: interface de múltiplas colunas (`Tickets`, `TicketsAdvanced`, `TicketsCustom`, `TicketResponsiveContainer`) com suporte a filtros por status, fila, tags, responsável e SLA.
- **Chat unificado**: visualização de mensagens, anexos, notas internas, widgets de informações do contato e histórico completo por `companyId`.
- **Transferências e roteamento**: mudança manual ou automática entre filas/atendentes, com modais personalizados (`TransferTicketModalCustom`, `TicketActionButtonsCustom`).
- **Kanban & Backlog**: painéis `Kanban` e `TagsKanban` para organizar tickets por estágio, prioridade e tags.

### 2. Conexões e sessões WhatsApp
- **Múltiplas conexões**: gerenciamento de dispositivos via páginas `Connections`, `WhatsAppModal`, `WhatsAppModalAdmin` e jobs `WbotServices`.
- **Dual Channel Support**: suporte simultâneo a **Baileys** (não oficial, gratuito) e **WhatsApp Business API Oficial** (Meta, pago, profissional).
  - Baileys: Conexão via QR Code, ideal para pequenas empresas (< 150 msg/dia)
  - API Oficial: Conexão via credenciais Meta, ideal para empresas maiores, sem risco de banimento, uptime 99.9%, templates aprovados
  - Arquitetura unificada com Adapter Pattern permite escolher o canal por conexão
  - Documentação completa: `.docs/funcionalidades/whatsapp-api-oficial/`
- **Monitoramento de status**: dashboards internos (Announcements, AuditLogs) e filas (`queueMonitor`) para acompanhar desconexões, reautenticações e métricas de envio.
- **APIs de mensagens**: endpoints `MessagesAPI`, `External API` e `Webhooks` permitem integração com sistemas terceiros.
- **Sistema de webhooks**: recebimento de eventos em tempo real da Meta via `/webhooks/whatsapp` para API Oficial.

### 3. Campanhas e fluxos automatizados
- **Campanhas segmentadas**: módulos `Campaigns`, `CampaignReport`, `CampaignDetailedReport`, `CampaignsPhrase`, `CampaignsConfig`, `ContactLists`, `ContactListItems` e `Moments` controlam disparos, templates, throttling e agendamentos.
- **Flow Builder**: editor visual (`FlowBuilder`, `FlowBuilderConfig`, nodes customizados) para construir jornadas, condicionais, perguntas, integração com OpenAI, Typebot e menus multi passo.
- **Smart automations**: recursos `FlowDefault`, `QueueIntegration`, `Moments` e `SystemConfig` alimentam gatilhos por filas, horários e respostas.

### 4. IA e automação cognitiva
- **Prompts e Assistentes**: página `Prompts`, serviços `IA/*` e RAG (`backend/src/services/RAG`) habilitam criação de assistentes, registro de uso (`AIUsageLogger`) e configuração de modelos OpenAI/GG.
- **RAG / Smart Files**: módulo `SmartFilesDashboard` + jobs `RAGIndexService` indexam documentos, permitem busca semântica e sugestões em tempo real dentro dos tickets.
- **Automação de atendente**: `QueueAIService`, `AIAnalyticsService` e integrações `OpenAiService` orquestram respostas automáticas, transcrição de áudio (`TranscribeAudioMessageService`) e classificação.

### 5. Gestão de contatos, tags e arquivos
- **Contacts & Lists**: importação, deduplicação (`ProcessDuplicateContactsService`), enriquecimento e tags, com UI dedicada (`Contacts`, `ContactLists`, `ContactListItems`).
- **Tags & regras**: módulos `Tags`, `TagModal`, `Rules`, `TagRulesCron` aplicam segmentações automáticas, posicionamento em Kanban e filtros dinâmicos.
- **Smart Files**: upload, categorização e reaproveitamento via `Files`, `SmartFilesDashboard` e APIs de mídia (com suporte a transcrição, validação e LGPD).

### 6. Dashboards, relatórios e métricas
- **Visão executiva**: páginas `Dashboard`, `Reports`, `CampaignReport` e `CampaignDetailedReport` consolidadas com filtros por período, fila, usuário e canal.
- **Indicadores operacionais**: componentes (`DashTickets*`, `ContactsReportService`, `Statistics/*`) fornecem métricas de atendimento, campanhas, filas, IA e uso de conexões.
- **Helps & Tutoriais**: módulo `Helps` centraliza documentação in-app (ex.: IA Tutorial, fluxos de onboarding).

### 7. Permissões, multi-empresa e planos
- **Multi-tenant nativo**: todo recurso é segmentado por `companyId` com limites definidos em `Plan` (`users`, `connections`, `queues`, flags de recursos). `Companies` e `CompaniesManager` permitem gestão de contas.
- **Perfis e escopos**: permissões granulares (`permissions`, `roles`, middlewares `checkPermission`, `isSuper`, `isAuthCompany`). UI com `Users`, `PermissionTransferList`, `SettingsCustom`.
- **Admin global**: usuários com `super=true` acessam módulos como `Companies`, `AuditLogs`, `AllConnections`, `Subscription` para controlar todo o tenant.

### 8. Financeiro e assinatura
- **Painel Financeiro**: página `Financeiro`/`Subscription` lista invoices, limites de plano, status de pagamento, trilhas de upgrade/downgrade.
- **Planos e billing**: APIs `PlanController`, `InvoicesService`, `FindAllPlanService` mantêm catálogo e associação aos `companyId`, suportando trials, recorrência e quotas automáticas.

### 9. Integrações e APIs externas
- **Webhooks e APIs**: `WebhookService`, `External API`, `MessagesAPI` expõem eventos e endpoints REST para CRM/ERP.
- **Queue Integration / Typebot / FlowBuilder**: conectores prontos para bots externos, automações RPA e pipelines customizados.
- **Monitoramento programático**: serviços `QueueMonitor`, `SavedFilterCronManager`, `TagRulesCron` e hooks de auditoria facilitam integrações com ferramentas de observabilidade.

### 10. Operação e monitoramento
- **Audit logs**: módulo `AuditLogs` + `AuditMiddleware` registram ações sensíveis (login, alterações de configurações, billing).
- **Announcements e Helps**: broadcasting de comunicados e guias diretamente no frontend (`Announcements`, `Helps`).
- **Diagnósticos**: scripts em `backend/scripts`, docs em `.docs/diagnosticos/` e páginas in-app (`Diagnostics`, `SystemConfig`) para checar filas, conexões, memória e jobs.

### 11. Anti-ban e governança
- **Limites adaptativos**: parâmetros como `CAP_HOURLY`, `CONTACT_FILTER_*`, `MESSAGE_INTERVAL_SEC` e rotinas `TagRulesCron`, `validateWhatsappContactsQueue` ajustam cadência de disparos.
- **Auditoria de contatos**: validação assíncrona, filtros SQL e deduplicação reduzem risco de spam.
- **Documentação dedicada**: `.docs/funcionalidades/anti-ban.md` e arquivos `legacy/ANTI-BAN-*.md` descrevem políticas de uso, integrações com Baileys e checklists de segurança.

### 12. Recursos auxiliares
- **Uploads e LGPD**: configuração de `FILESYSTEM_DRIVER`, sanitização de mídia, opções de anonimização (`LGPD` flags).
- **Ferramentas de suporte**: `Helps`, `ToDoList`, `Announcements`, `AuditLogs`, `SettingsCustom` centralizam governança e comunicação com clientes.
- **Scripts e diagnósticos**: diretórios `lib/`, `utils/`, `backend/scripts/` e `.docs/sql/` oferecem automações para migrações, correções e análises.

### 13. Próximas evoluções (relacionadas)
- **Auto-onboarding SaaS** conforme análise em `.docs/branchs/main/auto-onboarding-saas.md`.
- **Console de administração SaaS** (`.docs/branchs/main/admin-saas-console.md`) para consolidar gestão de empresas, planos e billing.
- **Otimizações de build** (docker multi-stage, Buildx, `.dockerignore`) já implementadas e documentadas em `.docs/docker-build.md`.

> Atualize este documento sempre que uma nova funcionalidade chegar ao repositório ou quando fluxos existentes forem alterados significativamente.

