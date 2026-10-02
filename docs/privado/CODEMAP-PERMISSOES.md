# 🗺️ Codemap de Permissões — 9s76hm2

> Gerado em 2026-10-02 a partir do código (pós-modularização).
> Tabelas geradas por `docs/privado/gen-perm-map.cjs` — re-rodar após mudanças.

## 1. Arquitetura (pipeline de autorização)

```
Request autenticado (isAuth → req.user {id, profile, companyId} do JWT)
        │
        ▼
modules/permissions/guards.ts            middleware de rota
  checkPermission / Any / All            getCachedUser: User.findByPk (cache 30s)
        │
        ▼
modules/permissions/resolver.ts          resolução do set efetivo
  hasPermissionAsync(user, perm)
        │
        ▼ getUserPermissionsAsync(user)
        │
        ├─ user.super === true ──────────→ TODAS as permissões (god-mode)
        ├─ profile === "admin":
        │    ├─ sem UserRoles ───────────→ getAdminPermissions() (fallback legado)
        │    └─ com UserRoles ───────────→ base ∪ flags ∪ ACL ∪ roles
        └─ demais usuários ──────────────→ base ∪ flags ∪ ACL (user.permissions) ∪ roles
```

### Regras-chave do resolver (`backend/src/modules/permissions/resolver.ts`)

| Regra | Detalhe |
|---|---|
| Base não-admin | `getBaseUserPermissions()` — tickets.view/create/update, quick-messages.view, contacts.view, tags.view, helps.view, announcements.view |
| Flags legadas | `allTicket`→`tickets.update/transfer/view-all`; `allowGroup`→`tickets.view-groups`; `allHistoric`→`view-all-historic`; `allUserChat`→`view-all-users`; `userClosePendingTicket`→`tickets.close`; `showDashboard`→`dashboard.view`+`reports.view`; `allowRealTime`→`realtime.view`; `allowConnections`→`connections.view`+`connections.edit` |
| ACL pontual | `user.permissions` (JSON) é **UNIÃO** com base+flags — nunca substitui |
| Roles | `Roles` × `UserRoles` por `companyId`, sempre aditivas (não revogam) |
| Normalização | `normalizePermissions`: `.edit`/`.create`/`.delete`/`.upload` implicam `.view` |
| Wildcard | `prefix.*` cobre todas as chaves do prefixo |
| Assimetria sync/async | `getUserPermissions` (sync) mantém blanket de admin — superset não-autorizativo para usos internos (ActionExecutor etc.); autorização real sempre via `hasPermissionAsync` |

### Fontes de verdade

| Artefato | Arquivo | Papel |
|---|---|---|
| Catálogo | `backend/src/modules/permissions/catalog.ts` | `AVAILABLE_PERMISSIONS` (124 chaves, 11 grupos) + labels/descriptions + `getPermissionsCatalog()` |
| Resolver | `backend/src/modules/permissions/resolver.ts` | sync + async + cache de roles (60s, `rolePermissions:{uid}:{cid}`) |
| Guards | `backend/src/modules/permissions/guards.ts` | middlewares Express + `getCachedUser` (30s, `user:{id}`) |
| Facades | `helpers/PermissionAdapter.ts`, `middleware/checkPermission.ts` | re-export — compat com imports antigos |
| Serialização | `helpers/SerializeUser.ts` | envia `permissions` = set efetivo calculado ao frontend |
| Catálogo p/ UI | `GET /permissions/catalog` | alimenta PermissionTransferList e seeds de RolesTab |

### Persistência

| Tabela | Conteúdo |
|---|---|
| `Users.permissions` (JSON) | ACL pontual do usuário |
| `Roles` | name, description, permissions JSON, companyId — "Administrador" é role de sistema por empresa |
| `UserRoles` | userId × roleId × companyId (unique userId+roleId) |
| `UserGroupPermission` | userId × contactId — ACL por contato (eixo de dados, separado) |

## 2. Enforcement no backend — 3 níveis

1. **Rota** — `checkPermission("x.y")` na definição da rota (a maioria)
2. **Controller/ação** — verificação granular dentro do handler: `bulkProcess` (ações bulk-edit-*), `ContactController.update` (campos sensíveis alterados), `UserController` (update/updateLanguage/mediaUpload/uploadAvatar), `MessageController` (allowedConnectionIds + all-connections.view)
3. **Serviço/dados** — escopo de dados (seção 4)

## 3. Frontend — pontos de guarda

| Mecanismo | Arquivo | Uso |
|---|---|---|
| `PrivateRoute permission=` | `routes/index.js` + `routes/PrivateRoute.js` | guarda de rota; redirect p/ /tickets com toast amigável (mapa PERMISSION_LABELS) |
| `usePermissions()` | `hooks/usePermissions.js` | `hasPermission/hasAnyPermission/hasAllPermissions` — única API de capacidade |
| `isAdmin()`/`isSuper()` | idem | helpers de **hierarquia** (escopo), não de capacidade |
| Menu | `layout/MainListItems.js` | itens gated por hasPermission/`user.super` |

`user.permissions` chega serializado como set efetivo — o frontend não recalcula roles/flags.

## 4. Eixo ortogonal: escopo de DADOS (não é permissão)

Checks de `profile`/`super`/flags que permanecem **de propósito** — decidem *quais registros* aparecem, não *o que pode fazer*:

| Mecanismo | Onde | Efeito |
|---|---|---|
| `allowedConnectionIds` | ListTicketsService, KanbanList, WhatsAppController.index, MessageController | conexões visíveis (não-super) |
| `allowedContactTags` (tag `#`) | ListContactsService, GetUserPersonalTagContactIds, TagController | carteira do usuário |
| `managedUserIds` + `supervisorViewMode` | ListTicketsService, Kanban | supervisão de carteiras |
| `queues` do usuário | ListTicketsService | filas visíveis |
| `profile==="admin"`/`super` | ~65 pontos em services/controllers | bypass de escopo (ver tudo do tenant) |
| `UserGroupPermission` | ListTicketsService | acesso a contatos de grupos específicos |
| Governança `super` | CreateUserService, UpdateUserService, RoleService | só super cria admin/concede perms super |

## 5. Mapa permissão → enforcement

Regenerar: `node docs/privado/gen-perm-map.cjs` (emite `docs/privado/.perm-tables.md`).
"—" = sem uso fora do catálogo/registro. `routes/*` = guard de rota; `controllers/*`/`services/*` = check programático.

<!-- TABLES:START -->
### tickets

| Permissão | Backend (enforcement) | Frontend (uso) |
|---|---|---|
| `tickets.view` | `routes/api/apiMessageRoutes.ts`<br>`routes/messageRoutes.ts`<br>`routes/ticketNoteRoutes.ts`<br>`routes/ticketRoutes.ts`<br>`utils/__tests__/aiTrainingSandbox.spec.ts` | `components/CommandPalette/index.js`<br>`layout/MainListItems.js`<br>`pages/Users/RolesTab.js` |
| `tickets.create` | `routes/ticketRoutes.ts`<br>`routes/whatsappRoutes.ts` | `pages/Users/RolesTab.js` |
| `tickets.update` | `modules/permissions/resolver.ts`<br>`routes/messageRoutes.ts`<br>`routes/ticketNoteRoutes.ts`<br>`routes/ticketRoutes.ts`<br>`routes/ticketTagRoutes.ts` | `hooks/usePermissions.js`<br>`pages/Users/RolesTab.js` |
| `tickets.transfer` | `modules/permissions/resolver.ts`<br>`routes/ticketRoutes.ts` | `hooks/usePermissions.js`<br>`pages/Users/RolesTab.js` |
| `tickets.close` | `modules/permissions/resolver.ts`<br>`routes/ticketRoutes.ts` | `components/TicketListItem/index.js`<br>`components/TicketListItemCustom/index.js`<br>`components/TicketsManagerTabs/index.js`<br>`hooks/usePermissions.js`<br>`pages/Users/RolesTab.js` |
| `tickets.delete` | `routes/messageRoutes.ts`<br>`routes/ticketRoutes.ts` | `components/TicketActionButtonsCustom/index.js`<br>`components/TicketOptionsMenu/index.js`<br>`pages/Users/RolesTab.js` |
| `tickets.view-all` | `modules/permissions/resolver.ts` | `components/NotificationsPopOver/index.js`<br>`components/TicketsManagerTabs/index.js`<br>`hooks/usePermissions.js`<br>`pages/Users/RolesTab.js`<br>`utils/ticketPreviewPermissions.js` |
| `tickets.view-groups` | `modules/permissions/resolver.ts` | `components/NotificationsPopOver/index.js`<br>`components/TicketsManagerTabs/index.js`<br>`hooks/usePermissions.js`<br>`pages/Groups/index.js` |
| `tickets.view-all-historic` | `modules/permissions/resolver.ts` | `hooks/usePermissions.js`<br>`pages/Users/RolesTab.js` |
| `tickets.view-all-users` | `modules/permissions/resolver.ts` | `components/TicketsManagerTabs/index.js`<br>`hooks/usePermissions.js`<br>`pages/Users/RolesTab.js`<br>`utils/ticketPreviewPermissions.js` |
| `tickets.bulk-process` | `controllers/TicketController.ts`<br>`routes/ticketRoutes.ts` | `components/BulkProcessTicketsModal/index.js`<br>`components/TicketsManagerTabs/index.js` |
| `tickets.bulk-edit-status` | `controllers/TicketController.ts` | `components/BulkProcessTicketsModal/index.js` |
| `tickets.bulk-edit-queue` | `controllers/TicketController.ts` | `components/BulkProcessTicketsModal/index.js` |
| `tickets.bulk-edit-user` | `controllers/TicketController.ts` | `components/BulkProcessTicketsModal/index.js` |
| `tickets.bulk-edit-tags` | `controllers/TicketController.ts` | `components/BulkProcessTicketsModal/index.js` |
| `tickets.bulk-edit-wallets` | — | — |
| `tickets.bulk-edit-response` | `controllers/TicketController.ts` | `components/BulkProcessTicketsModal/index.js` |
| `tickets.bulk-edit-close` | `controllers/TicketController.ts` | `components/BulkProcessTicketsModal/index.js` |
| `tickets.bulk-edit-notes` | `controllers/TicketController.ts` | `components/BulkProcessTicketsModal/index.js` |

### quickMessages

| Permissão | Backend (enforcement) | Frontend (uso) |
|---|---|---|
| `quick-messages.view` | `routes/quickMessageRoutes.ts` | `components/CommandPalette/index.js`<br>`layout/MainListItems.js`<br>`pages/Users/RolesTab.js`<br>`routes/index.js` |
| `quick-messages.create` | `routes/quickMessageRoutes.ts` | — |
| `quick-messages.edit` | `routes/quickMessageRoutes.ts` | — |
| `quick-messages.delete` | `routes/quickMessageRoutes.ts` | — |

### contacts

| Permissão | Backend (enforcement) | Frontend (uso) |
|---|---|---|
| `contacts.view` | `routes/api/apiContactRoutes.ts`<br>`routes/contactRoutes.ts`<br>`routes/wbotLabelsRoutes.ts` | `components/CommandPalette/index.js`<br>`layout/MainListItems.js`<br>`pages/Users/RolesTab.js`<br>`routes/index.js` |
| `contacts.create` | `routes/contactRoutes.ts` | `pages/Users/RolesTab.js` |
| `contacts.edit` | `controllers/ContactController.ts`<br>`routes/contactRoutes.ts`<br>`routes/wbotLabelsRoutes.ts` | `components/ContactRow/index.js`<br>`pages/Users/RolesTab.js` |
| `contacts.edit-fields` | `controllers/ContactController.ts`<br>`routes/contactRoutes.ts` | `components/ContactModal/index.js` |
| `contacts.edit-tags` | `controllers/ContactController.ts`<br>`routes/labelsRoutes.ts`<br>`routes/tagRoutes.ts` | `components/ContactModal/index.js`<br>`pages/Users/RolesTab.js` |
| `contacts.edit-wallets` | `controllers/ContactController.ts` | `components/ContactModal/index.js`<br>`pages/Users/RolesTab.js` |
| `contacts.edit-representative` | `controllers/ContactController.ts` | `components/ContactModal/index.js`<br>`pages/Users/RolesTab.js` |
| `contacts.delete` | `controllers/ContactController.ts`<br>`routes/contactRoutes.ts` | `components/CampaignsPhrase/index.js`<br>`components/ContactCard/index.js`<br>`components/ContactImportWpModal/index copy.js`<br>`components/ContactImportWpModal/index.js`<br>`components/ContactRow/index.js`<br>`pages/Contacts/index.js`<br>`pages/FlowBuilder/index.js` |
| `contacts.import` | `routes/contactRoutes.ts`<br>`routes/instagramSessionRoutes.ts`<br>`routes/labelsRoutes.ts`<br>`routes/leadRoutes.ts`<br>`routes/leadScraperRoutes.ts` | `layout/MainListItems.js`<br>`pages/Contacts/index.js`<br>`pages/LeadScraper/index.js`<br>`pages/LeadsImport/index.js`<br>`pages/Users/RolesTab.js`<br>`routes/index.js` |
| `contacts.export` | `routes/statisticsRoutes.ts` | `pages/Contacts/index.js`<br>`pages/Users/RolesTab.js` |
| `contacts.bulk-edit` | `routes/contactRoutes.ts` | `pages/Contacts/index.js` |

### tags

| Permissão | Backend (enforcement) | Frontend (uso) |
|---|---|---|
| `tags.view` | `routes/labelsRoutes.ts`<br>`routes/tagRoutes.ts`<br>`routes/tagRuleRoutes.ts`<br>`routes/wbotLabelsRoutes.ts`<br>`routes/whatsappWebLabelsRoutes.ts` | `components/CommandPalette/index.js`<br>`layout/MainListItems.js`<br>`pages/Users/RolesTab.js`<br>`routes/index.js` |
| `tags.create` | `routes/contactRoutes.ts`<br>`routes/labelsRoutes.ts`<br>`routes/tagRoutes.ts` | `pages/Kanban/index.js`<br>`pages/Tags/index.js` |
| `tags.edit` | `routes/tagRoutes.ts`<br>`routes/tagRuleRoutes.ts`<br>`routes/wbotLabelsRoutes.ts`<br>`routes/whatsappWebLabelsRoutes.ts` | `components/TagTicketModal/index.js`<br>`pages/Kanban/index.js`<br>`pages/Tags/index.js` |
| `tags.delete` | `routes/tagRoutes.ts` | `pages/Kanban/index.js`<br>`pages/Tags/index.js` |

### helps

| Permissão | Backend (enforcement) | Frontend (uso) |
|---|---|---|
| `helps.view` | `routes/helpRoutes.ts`<br>`routes/ragRoutes.ts` | `layout/MainListItems.js`<br>`pages/Users/RolesTab.js`<br>`routes/index.js` |

### dashboard

| Permissão | Backend (enforcement) | Frontend (uso) |
|---|---|---|
| `dashboard.view` | `modules/permissions/resolver.ts`<br>`routes/dashboardRoutes.ts` | `components/CommandPalette/index.js`<br>`hooks/usePermissions.js`<br>`layout/MainListItems.js`<br>`pages/Dashboard/index.js`<br>`pages/Users/RolesTab.js` |
| `reports.view` | `modules/permissions/resolver.ts`<br>`routes/statisticsRoutes.ts`<br>`routes/ticketRoutes.ts` | `hooks/usePermissions.js`<br>`pages/Users/RolesTab.js`<br>`routes/index.js` |
| `realtime.view` | `modules/permissions/resolver.ts`<br>`routes/dashboardRoutes.ts`<br>`routes/statisticsRoutes.ts` | `hooks/usePermissions.js`<br>`layout/MainListItems.js`<br>`pages/Moments/index.js`<br>`pages/Users/RolesTab.js`<br>`routes/index.js` |

### campaigns

| Permissão | Backend (enforcement) | Frontend (uso) |
|---|---|---|
| `campaigns.view` | `routes/campaignRoutes.ts` | `components/CommandPalette/index.js`<br>`layout/MainListItems.js`<br>`pages/Campaigns/index.js`<br>`routes/index.js` |
| `campaigns.create` | `routes/campaignRoutes.ts` | `hooks/usePermissions.js`<br>`routes/index.js` |
| `campaigns.edit` | `routes/campaignRoutes.ts`<br>`routes/campaignSettingRoutes.ts` | `routes/index.js` |
| `campaigns.delete` | `routes/campaignRoutes.ts` | — |
| `contact-lists.view` | `routes/contactListItemRoutes.ts`<br>`routes/contactListRoutes.ts` | `components/CommandPalette/index.js`<br>`pages/ContactListItems/index.js`<br>`pages/Users/RolesTab.js`<br>`routes/index.js` |
| `contact-lists.create` | `routes/contactListRoutes.ts` | `pages/ContactLists/index.js`<br>`pages/Users/RolesTab.js` |
| `contact-lists.edit` | `routes/contactListItemRoutes.ts`<br>`routes/contactListRoutes.ts` | `pages/ContactListItems/index.js`<br>`pages/ContactLists/index.js`<br>`pages/Users/RolesTab.js` |
| `contact-lists.delete` | `routes/contactListRoutes.ts` | `pages/ContactLists/index.js` |
| `campaigns-config.view` | `routes/campaignSettingRoutes.ts` | `pages/CampaignsConfig/index.js`<br>`routes/index.js` |
| `email-campaigns.view` | `routes/emailCampaignRoutes.ts` | `components/CommandPalette/index.js`<br>`layout/MainListItems.js`<br>`routes/index.js` |
| `email-campaigns.create` | `routes/emailCampaignRoutes.ts` | `pages/EmailCampaigns/index.js` |
| `email-campaigns.edit` | `routes/emailCampaignRoutes.ts` | `pages/EmailCampaigns/index.js` |
| `email-campaigns.delete` | `routes/emailCampaignRoutes.ts` | `pages/EmailCampaigns/index.js` |
| `drip-sequences.view` | `routes/dripSequenceRoutes.ts` | `layout/MainListItems.js`<br>`routes/index.js` |
| `drip-sequences.create` | `routes/dripSequenceRoutes.ts` | `pages/FollowUps/index.js`<br>`routes/index.js` |
| `drip-sequences.edit` | `routes/dripSequenceRoutes.ts` | `pages/FollowUps/index.js`<br>`routes/index.js` |
| `drip-sequences.delete` | `routes/dripSequenceRoutes.ts` | `pages/FollowUps/index.js` |
| `meta-templates.view` | `routes/metaTemplateRoutes.ts`<br>`routes/templateRoutes.ts` | `layout/MainListItems.js`<br>`routes/index.js` |
| `meta-templates.create` | `routes/metaTemplateRoutes.ts` | `pages/MetaTemplates/index.js` |
| `meta-templates.edit` | `routes/metaTemplateRoutes.ts` | `pages/MetaTemplates/index.js` |
| `meta-templates.delete` | `routes/metaTemplateRoutes.ts` | `pages/MetaTemplates/index.js` |

### flowbuilder

| Permissão | Backend (enforcement) | Frontend (uso) |
|---|---|---|
| `flowbuilder.view` | `routes/flowBuilderRoutes.ts`<br>`routes/flowDefaultRoutes.ts` | `components/CommandPalette/index.js`<br>`components/WhatsAppModal/index.js`<br>`layout/MainListItems.js`<br>`routes/index.js` |
| `flowbuilder.create` | `routes/flowBuilderRoutes.ts` | `pages/FlowBuilder/index.js`<br>`pages/FlowBuilderConfig/index.js` |
| `flowbuilder.edit` | `routes/flowBuilderRoutes.ts`<br>`routes/flowDefaultRoutes.ts` | `pages/FlowBuilder/index.js`<br>`pages/FlowBuilderConfig/index.js`<br>`pages/FlowDefault/index.js` |
| `flowbuilder.delete` | `routes/flowBuilderRoutes.ts` | `pages/FlowBuilder/index.js` |
| `phrase-campaigns.view` | `routes/flowCampaignRoutes.ts` | `routes/index.js` |
| `phrase-campaigns.create` | `routes/flowCampaignRoutes.ts` | `pages/CampaignsPhrase/index.js` |
| `phrase-campaigns.edit` | `routes/flowCampaignRoutes.ts` | `pages/CampaignsPhrase/index.js` |
| `phrase-campaigns.delete` | `routes/flowCampaignRoutes.ts` | `pages/CampaignsPhrase/index.js` |

### modules

| Permissão | Backend (enforcement) | Frontend (uso) |
|---|---|---|
| `kanban.view` | `routes/tagRoutes.ts`<br>`routes/ticketRoutes.ts` | `components/CommandPalette/index.js`<br>`layout/MainListItems.js`<br>`pages/Users/RolesTab.js`<br>`routes/index.js` |
| `schedules.view` | `routes/ScheduledMessagesRoutes.ts`<br>`routes/scheduleRoutes.ts` | `components/CommandPalette/index.js`<br>`layout/MainListItems.js`<br>`pages/Users/RolesTab.js`<br>`routes/index.js` |
| `schedules.create` | `routes/ScheduledMessagesRoutes.ts`<br>`routes/scheduleRoutes.ts` | `pages/Schedules/index.js` |
| `schedules.edit` | `controllers/ScheduleController.ts`<br>`controllers/ScheduledMessagesController.ts`<br>`routes/ScheduledMessagesRoutes.ts`<br>`routes/scheduleRoutes.ts` | `pages/Schedules/index.js` |
| `schedules.delete` | `routes/ScheduledMessagesRoutes.ts`<br>`routes/scheduleRoutes.ts` | `pages/Schedules/index.js` |
| `internal-chat.view` | `routes/chatRoutes.ts` | `layout/index.js`<br>`layout/MainListItems.js`<br>`pages/Users/RolesTab.js`<br>`routes/index.js` |
| `external-api.view` | — | `layout/MainListItems.js`<br>`routes/index.js` |
| `prompts.view` | `routes/promptRoutes.ts` | `components/WhatsAppModal/index.js`<br>`layout/MainListItems.js` |
| `prompts.create` | — | — |
| `prompts.edit` | — | — |
| `prompts.delete` | — | — |
| `integrations.view` | `routes/queueIntegrationRoutes.ts` | `components/QueueModal/index.js`<br>`components/WhatsAppModal/index.js`<br>`layout/MainListItems.js`<br>`pages/QueueIntegration/index.js`<br>`routes/index.js` |
| `ai-agents.view` | `routes/aiAgentRoutes.ts` | `components/CommandPalette/index.js`<br>`layout/MainListItems.js`<br>`routes/index.js` |
| `ai-agents.create` | `routes/aiAgentRoutes.ts` | `pages/AIAgents/index.js` |
| `ai-agents.edit` | `routes/aiAgentRoutes.ts` | `pages/AIAgents/index.js` |
| `ai-agents.delete` | `routes/aiAgentRoutes.ts` | `pages/AIAgents/index.js` |
| `ai-training.view` | `routes/aiRoutes.ts` | `components/CommandPalette/index.js`<br>`layout/MainListItems.js`<br>`pages/AITraining/index.js`<br>`routes/index.js` |
| `ai-chat-assistant.use` | `routes/aiRoutes.ts` | `components/MessageInput/index.js`<br>`components/MetaTemplateModal/index.js`<br>`pages/FollowUps/FollowUpForm.js`<br>`pages/Users/RolesTab.js` |
| `announcements.view` | `routes/announcementRoutes.ts` | `components/CommandPalette/index.js`<br>`layout/index.js`<br>`pages/Users/RolesTab.js`<br>`routes/index.js` |
| `announcements.create` | `routes/announcementRoutes.ts` | `pages/Annoucements/index.js` |
| `announcements.edit` | `routes/announcementRoutes.ts` | `pages/Annoucements/index.js` |
| `announcements.delete` | `routes/announcementRoutes.ts` | `pages/Annoucements/index.js` |

### admin

| Permissão | Backend (enforcement) | Frontend (uso) |
|---|---|---|
| `users.view` | `controllers/UserController.ts`<br>`modules/permissions/guards.ts`<br>`routes/userGroupPermissionRoutes.ts`<br>`routes/userRoutes.ts` | `components/CommandPalette/index.js`<br>`components/TagModal/index.js`<br>`hooks/useUsers/index.js`<br>`hooks/useUsersList.js`<br>`layout/MainListItems.js`<br>`pages/Users/index.js`<br>`routes/index.js` |
| `users.create` | `controllers/UserController.ts`<br>`routes/userRoutes.ts` | `pages/Users/index.js` |
| `users.edit` | `controllers/UserController.ts`<br>`modules/permissions/guards.ts`<br>`routes/userGroupPermissionRoutes.ts`<br>`routes/userRoutes.ts`<br>`services/UserServices/UpdateUserService.ts` | `components/ModalUsers/index.js`<br>`components/UserModal/index.js`<br>`pages/Users/index.js` |
| `users.edit-own` | `controllers/UserController.ts` | `components/UserModal/index.js` |
| `users.delete` | `controllers/UserController.ts`<br>`routes/userRoutes.ts` | `pages/Users/index.js` |
| `queues.view` | `routes/chatBotRoutes.ts`<br>`routes/queueOptionRoutes.ts`<br>`routes/queueRoutes.ts` | `components/CommandPalette/index.js`<br>`components/WhatsAppModal/index.js`<br>`layout/MainListItems.js`<br>`pages/Queues/index.js`<br>`routes/index.js` |
| `queues.create` | `routes/queueOptionRoutes.ts`<br>`routes/queueRoutes.ts` | — |
| `queues.edit` | `routes/chatBotRoutes.ts`<br>`routes/queueOptionRoutes.ts`<br>`routes/queueRoutes.ts` | `pages/Queues/index.js` |
| `queues.delete` | `routes/queueOptionRoutes.ts`<br>`routes/queueRoutes.ts` | `pages/Queues/index.js` |
| `connections.view` | `modules/permissions/resolver.ts`<br>`routes/metaOAuthRoutes.ts`<br>`routes/whatsappRoutes.ts` | `components/CommandPalette/index.js`<br>`components/CompanyWhatsapps/index.js`<br>`hooks/usePermissions.js`<br>`layout/MainListItems.js`<br>`pages/Connections/index.js`<br>`routes/index.js` |
| `connections.create` | `routes/metaOAuthRoutes.ts`<br>`routes/whatsappRoutes.ts`<br>`routes/whatsappSessionRoutes.ts` | `hooks/usePermissions.js`<br>`pages/Connections/index.js` |
| `connections.edit` | `controllers/WhatsAppController.ts`<br>`controllers/WhatsAppSessionController.ts`<br>`modules/permissions/resolver.ts`<br>`routes/contactRoutes.ts`<br>`routes/whatsappRoutes.ts`<br>`routes/whatsappSessionRoutes.ts`<br>`routes/whatsappWebLabelsRoutes.ts` | `components/CompanyWhatsapps/index.js`<br>`hooks/usePermissions.js`<br>`pages/Admin/tabs/ConexoesTab.js`<br>`pages/AllConnections/index.js`<br>`pages/Connections/index.js` |
| `connections.delete` | `controllers/WhatsAppController.ts`<br>`routes/whatsappRoutes.ts`<br>`routes/whatsappSessionRoutes.ts` | `hooks/usePermissions.js` |
| `files.view` | `routes/filesRoutes.ts`<br>`routes/libraryFileRoutes.ts`<br>`routes/libraryFolderRoutes.ts`<br>`routes/queueRAGSourceRoutes.ts` | `components/QueueModal/index.js`<br>`layout/MainListItems.js`<br>`pages/Files/index.js`<br>`routes/index.js` |
| `files.upload` | `controllers/FilesController.ts`<br>`routes/filesRoutes.ts`<br>`routes/libraryFileRoutes.ts`<br>`routes/libraryFolderRoutes.ts`<br>`routes/queueRAGSourceRoutes.ts` | `pages/Files/index.js` |
| `files.delete` | `routes/filesRoutes.ts`<br>`routes/libraryFileRoutes.ts`<br>`routes/libraryFolderRoutes.ts` | `pages/Files/index.js` |
| `financeiro.view` | `routes/invoicesRoutes.ts` | `components/CommandPalette/index.js`<br>`layout/MainListItems.js`<br>`routes/index.js` |
| `financeiro.edit` | `routes/invoicesRoutes.ts`<br>`routes/subScriptionRoutes.ts` | — |
| `settings.view` | `controllers/SettingController.ts`<br>`routes/auditLogRoutes.ts`<br>`routes/companyRoutes.ts`<br>`routes/companySettingsRoutes.ts`<br>`routes/contactReleaseRequestRoutes.ts`<br>`routes/planRoutes.ts`<br>`routes/presetRoutes.ts`<br>`routes/settingRoutes.ts` | `components/AddFilteredContactsModal/index.js`<br>`components/CommandPalette/index.js`<br>`components/NotificationsPopOver/index.js`<br>`components/TicketListItemCustom/index.js`<br>`hooks/useSettings/companySettings.js`<br>`hooks/useSettings/index.js`<br>`layout/MainListItems.js`<br>`pages/Settings/index.js`<br>`pages/SettingsCustom/index.js`<br>`routes/index.js` |
| `settings.edit` | `controllers/SettingController.ts`<br>`routes/companyRoutes.ts`<br>`routes/companySettingsRoutes.ts`<br>`routes/customFieldConfigRoutes.ts`<br>`routes/debugRoutes.ts`<br>`routes/helpRoutes.ts`<br>`routes/maintenanceRoutes.ts`<br>`routes/presetRoutes.ts`<br>`routes/queueIntegrationRoutes.ts`<br>`routes/settingRoutes.ts`<br>`routes/versionRoutes.ts` | `components/AddFilteredContactsModal/index.js`<br>`hooks/useSettings/companySettings.js`<br>`hooks/useSettings/index.js`<br>`layout/MainListItems.js`<br>`routes/index.js` |
| `ai-settings.view` | `routes/aiModelRoutes.ts`<br>`routes/aiRoutes.ts`<br>`routes/featureFlagRoutes.ts`<br>`routes/skillRoutes.ts` | `components/CommandPalette/index.js`<br>`layout/MainListItems.js`<br>`routes/index.js` |
| `ai-settings.edit` | `routes/aiRoutes.ts`<br>`routes/featureFlagRoutes.ts`<br>`routes/ragRoutes.ts`<br>`routes/skillRoutes.ts` | `pages/KnowledgeBase/index.js` |
| `roles.view` | `routes/permissionRoutes.ts`<br>`routes/roleRoutes.ts` | `components/CommandPalette/index.js`<br>`components/UserModal/index.js`<br>`layout/MainListItems.js`<br>`pages/Users/index.js`<br>`pages/Users/RolesTab.js`<br>`routes/index.js` |
| `roles.create` | `routes/roleRoutes.ts` | `pages/Users/RolesTab.js` |
| `roles.edit` | `routes/roleRoutes.ts` | `components/UserModal/index.js`<br>`pages/Users/RolesTab.js` |
| `roles.delete` | `routes/roleRoutes.ts` | `pages/Users/RolesTab.js` |

### super

| Permissão | Backend (enforcement) | Frontend (uso) |
|---|---|---|
| `announcements.view` | `routes/announcementRoutes.ts` | `components/CommandPalette/index.js`<br>`layout/index.js`<br>`pages/Users/RolesTab.js`<br>`routes/index.js` |
| `announcements.create` | `routes/announcementRoutes.ts` | `pages/Annoucements/index.js` |
| `announcements.edit` | `routes/announcementRoutes.ts` | `pages/Annoucements/index.js` |
| `announcements.delete` | `routes/announcementRoutes.ts` | `pages/Annoucements/index.js` |
| `companies.view` | `routes/companyRoutes.ts` | `routes/index.js` |
| `companies.create` | — | `pages/Admin/tabs/EmpresasTab.js`<br>`pages/Companies/index.js` |
| `companies.edit` | `routes/companyRoutes.ts` | `pages/Admin/tabs/EmpresasTab.js`<br>`pages/Companies/index.js` |
| `companies.delete` | `routes/companyRoutes.ts` | `pages/Admin/tabs/EmpresasTab.js`<br>`pages/Companies/index.js` |
| `all-connections.view` | `controllers/MessageController.ts`<br>`services/TicketServices/ListTicketsService.ts` | `components/NotificationsPopOver/index.js`<br>`pages/Admin/tabs/ConexoesTab.js`<br>`pages/AllConnections/index.js` |

<!-- TABLES:END -->

## 6. Exceções conhecidas e dívidas

| Item | Status |
|---|---|
| `prompts.create/edit/delete` | Chaves mortas (feature virou AI Agents); mantidas p/ não orfanar ACLs |
| `tickets.bulk-edit-wallets` | Sem uso — o payload bulk não tem ação de carteira hoje |
| `external-api.view` | Frontend-only por design (API externa autentica por token, `isAuthCompany`) |
| `companies.create` | Front usa chave granular; backend usa `checkSuper` (equivalente — só super tem) |
| `quick-messages.create/edit/delete`, `campaigns.delete`, `queues.create`, `financeiro.edit` | Backend-only — rotas protegidas; UI mostra ação pra quem tem a permissão pai |
| Tags `#` | Criar/editar/deletar tag pessoal exige `profile==="admin"` (governança de carteira — dívida: granularizar em `tags.manage-personal`) |
| `TicketNoteController.remove` | Check de admin é o único gate (rota usa `tickets.update`) — intencional |
| `TagServices/ListService` | Filtro de tags pessoais é dead code (condição contraditória) — anotado |
| Admin renomear role "Administrador" | Possível — guardas de delete/demote casam por nome (hardening futuro: flag isSystem) |
| `getUserPermissions` sync | Blanket admin mantido (não-autorizativo); gates reais são async |
