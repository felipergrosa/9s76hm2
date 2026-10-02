# 🔐 Plano de Modularização do Sistema de Permissões

> **Status**: Proposta aprovada para planejamento (aguardando execução por fase)
> **Data**: 2026-10-01
> **Decisões tomadas**: (a) `admin` vira composição de permissões, não perfil mágico; (b) execução fase a fase com aprovação

---

## 1. Estado atual (auditado em código)

### Camadas sobrepostas

| Camada | Mecanismo | Onde |
|---|---|---|
| Perfil legado | `User.profile` ("user"/"admin"), `User.super` + flags (`allTicket`, `allowGroup`, `allHistoric`, `allUserChat`, `userClosePendingTicket`, `showDashboard`, `allowRealTime`, `allowConnections`) | `backend/src/models/User.ts` |
| ACL pontual | `User.permissions` (JSON array) — para não-admin **substitui** flags; para admin **é ignorada** | `PermissionAdapter.ts:251-258` |
| RBAC | `Roles` + `UserRoles` (por `companyId`), **unidas** às permissões base — só para não-admin | `PermissionAdapter.ts:346-472`, `RoleController` |
| ACL por registro | `UserGroupPermission` (userId × contactId) — visibilidade de dados (carteiras/hierarquia) | `models/UserGroupPermission.ts`, `ListTicketsService` |
| Escopo de dados | `managedUserIds`, `supervisorViewMode`, `allowedContactTags`, `allowedConnectionIds`, `queues`, `whatsappId` | `User.ts` + serviços de listagem |

### Enforcement

- **Backend**: `checkPermission(perm)` em ~560 rotas; `checkAdminOrSuper`, `checkSuper` (legado); `getCachedUser` cache 30s + role cache 60s
- **Frontend**: `SerializeUser` envia `permissions` = **set efetivo calculado**; `usePermissions` (rotas/condicionais), `<Can>` + `rules.js` (legado com fallbacks mortos), ~43 checks diretos `profile === "admin"`/`user.super`

### Problemas confirmados

| # | Problema | Severidade |
|---|---|---|
| P1 | Admin binário — impossível "admin limitado" | Estrutural |
| P2 | `GET /companies` e `/companies/:id` só com `isAuth` — qualquer usuário autenticado lista todas as empresas (vazamento multitenant) | **Alta (segurança)** |
| P3 | Permissões frontend-only nunca checadas no backend: `tickets.view-all*`, `tickets.bulk-*`, `contacts.edit-wallets`, `prompts.*`, `ai-chat-assistant.use`, `external-api.view` | Alta |
| P4 | Três engines de check no frontend (`usePermissions`, `Can`, `rules.js`) + 43 checks diretos de profile/super | Média |
| P5 | Roles só aditivas — sem revogação explícita | Média |
| P6 | Toast vaza chave crua e aparece na tela errada após redirect | Baixa (UX) |
| P7 | Mudança de permissão propaga em até ~60s (caches) | Baixa |
| P8 | Mistura na UI de "capacidade" vs "acesso a dados" | Média (UX) |

---

## 2. Arquitetura alvo

```
┌─────────────────────────────────────────────────────────┐
│                    RESOLVER (backend)                    │
│  PermissionResolver.resolve(user) → Set<permission>      │
│                                                          │
│  1. user.super === true        → TODAS (global)          │
│  2. união: Role[] × companyId  → permissões da empresa   │
│  3. união: User.permissions    → ACL pontual             │
│  4. união: flags legadas       → retrocompat (deprecated)│
│  5. profile                  → apenas label hierárquica  │
│     (menus/supervisão), NÃO concede permissão            │
└─────────────────────────────────────────────────────────┘
           │                                    │
    checkPermission(perm)               SerializeUser
    (guard de rota)                     (set efetivo → front)
           │                                    │
    ┌──────┴──────┐                   usePermissions()
    │  services   │                   (única API do front)
    │  controllers│
    └─────────────┘
```

### Princípios

1. **`profile` deixa de conceder permissão** — vira label de hierarquia/visibilidade ("quem pode ver o quê" continua usando carteiras/filas/supervisor). `super` permanece god-mode global (dono SaaS).
2. **Fonte única de verdade**: `PermissionCatalog` no backend; frontend recebe catálogo via `/permissions/catalog` (já existe) e set efetivo via `SerializeUser` (já existe).
3. **Roles nativas por tenant**: "Administrador" (implícita/auto-criada por empresa), "Supervisor", "Atendente" — editáveis por quem tem `roles.edit`.
4. **Backend é a autoridade** — toda capacidade precisa de `checkPermission` na rota ou no service; frontend só esconde UI.
5. **Separação de eixos na UI**: aba "Permissões" (capacidades) vs aba "Acesso a dados" (carteiras, filas, conexões, contatos, subordinados).

---

## 3. Fases de implementação

### Fase 1 — Fundação + fechamento de gaps de segurança

**Objetivo**: módulo de permissões + corrigir exposições, sem mudar comportamento.

| Passo | Mudança | Arquivos |
|---|---|---|
| 1.1 | Criar `backend/src/modules/permissions/`: `catalog.ts` (move `AVAILABLE_PERMISSIONS` + labels/descriptions de `PermissionAdapter`), `resolver.ts` (lógica de resolução), `guards.ts` (checkPermission/Any/All/AdminOrSuper) | novos; `PermissionAdapter.ts` vira facade que re-exporta |
| 1.2 | `GET /companies`, `/companies/:id`, `/companiesPlan`, `listPlan` → `checkPermission("companies.view")` (super-only) | `companyRoutes.ts` |
| 1.3 | Teste: usuário comum autenticado → 403 em `GET /companies`; super → 200 | teste manual/API |
| 1.4 | Frontend: `usePermissions` vira única API; `<Can>` e `rules.js` marcados deprecated; migrar os ~17 usages de `<Can>` para `hasPermission` | `frontend/src/` |
| 1.5 | Invalidação reativa: `UpdateUserService`/`RoleController` já invalidam — garantir que `user:` cache do guard também é invalidado | `checkPermission.ts`, `serviceCache` |

**Critério de saída**: `GET /companies` retorna 403 para não-super; tsc+build limpos; nenhuma funcionalidade quebrada.

### Fase 2 — Enforcement real no backend

**Objetivo**: toda permissão do catálogo que o frontend cobra passa a ser verificada no backend.

| Passo | Mudança |
|---|---|
| 2.1 | Auditar rota a rota as permissões "frontend-only" (P3): mapear endpoint correto e adicionar `checkPermission` — cuidado com fluxos internos (socket, jobs) que não passam por rota |
| 2.2 | `bulk-edit-*`: hoje `tickets.bulk-process`/`bulk-edit-*` existem no catálogo — o endpoint `POST /tickets/bulk-process` usa `tickets.update`; decidir: granular por ação dentro do payload (service lê `data.actions`) ou guarda única `tickets.bulk-process` na rota + granular nos campos do modal |
| 2.3 | `contacts.edit-wallets`, `contacts.edit-representative`, `contacts.edit-tags`, `contacts.edit-fields`: o `PUT /contacts/:id` hoje usa `contacts.edit` — adicionar verificação por campo alterado no `UpdateContactService` (se payload toca `wallets` → exige `contacts.edit-wallets` etc.) |
| 2.4 | `prompts.*`, `ai-chat-assistant.use`, `external-api.view`: adicionar nas rotas correspondentes |
| 2.5 | Teste E2E: usuário com role limitada tenta chamar endpoints direto (curl) → 403 |

**Critério de saída**: nenhum endpoint cobrado no frontend fica aberto no backend; regressão E2E nos fluxos principais.

### Fase 3 — Admin como composição

**Objetivo**: `profile="admin"` deixa de conceder permissões automaticamente.

| Passo | Mudança |
|---|---|
| 3.1 | Migration: para cada `companyId`, criar Role "Administrador" com `getAdminPermissions()` (se não existir); para cada user `profile="admin"`, criar `UserRole` vinculando à role "Administrador" da empresa |
| 3.2 | `PermissionResolver`: remover early-return de admin (`getAdminPermissions()`); admin resolve como qualquer usuário (roles + ACL + flags). `super` continua first |
| 3.3 | `usePermissions.isAdmin()` / `user.profile === "admin"` frontend (~43 pontos): manter `profile` como label de hierarquia (visibilidade de tickets, menus de gestão) — mas permissões de capacidade passam pelo resolver. Auditar cada uso: se é "capacidade" → migrar pra `hasPermission`; se é "hierarquia/dados" → fica |
| 3.4 | Idem backend (~76 checks de profile/super em services/controllers): capacidade → `hasPermissionAsync`; hierarquia → permanece |
| 3.5 | `users.permissions` deixa de substituir flags — vira união (ACL pontual sempre aditiva, igual roles). Flags legadas continuam até migração final |
| 3.6 | Role "Administrador" é **protegida**: não pode ser deletada se houver admins vinculados; sempre existe por empresa |

**Critério de saída**: criar user "admin" → ganha role Administrador automaticamente; remover uma permissão da role → admin perde acesso à tela/endpoint; nenhum admin atual perde acesso (migração preserva 1:1).

### Fase 4 — UX + polish

| Passo | Mudança |
|---|---|
| 4.1 | `PrivateRoute`: mensagem amigável (mapa chave→label do catálogo via `/permissions/catalog`) ou genérica; redirect pra primeira rota permitida do usuário, não sempre `/tickets` |
| 4.2 | `UserModal`: aba "Permissões" (capacidades) vs aba "Acesso a dados" (filas, carteiras, `allowedConnectionIds`, `allowedContactTags`, `managedUserIds`, `supervisorViewMode`) — a aba "Como usar?" já documenta, só reorganizar os campos |
| 4.3 | `RolesTab`: seed de roles padrão (Atendente, Supervisor, Administrador) + botão "duplicar role" |
| 4.4 | Indicador de propagação: toast "Permissões atualizadas — efetivas em até 1 min" ou invalidação imediata |

---

## 4. Edge cases mapeados

- **Tenant isolation**: `UserRole`/`Role` por `companyId` — usuário nunca herda role de outra empresa; validar `roleId.companyId === user.companyId` no `setUserRoles`
- **Lockout**: admin remove `users.edit` de si mesmo → fica sem gerenciar usuários; mitigar: super sempre pode; opcional: impedir remover `users.edit` do próprio user
- **JWT staleness**: token carrega só `id/profile/companyId` — permissões vêm do banco a cada request (cache 30s), então revogação funciona sem relogin
- **Sessões/sockets**: handlers de socket devem usar o resolver também (auditar `socketAuth`/`verifySocketUser`)
- **Import/migração**: `normalizePermissions` garante `.view` quando tem `.edit/.create/.delete` — manter invariante no resolver
- **Rollback por fase**: cada fase é revertível isoladamente; Fase 3 tem migration com `down` restaurando early-return de admin

## 5. Fora de escopo (por ora)

- Revogação explícita por role (negação) — união apenas; se surgir necessidade, reabrir P5
- `UserGroupPermission` (ACL por contato) — permanece como está; é eixo de dados, não de capacidade
- Permissões por conexão WhatsApp além de `allowedConnectionIds`

## 6. Decisões de execução (registro)

- **Tags `#` (carteiras)**: `TagController`/`TagModal` mantêm check de `profile === "admin"` — governança de hierarquia, não capacidade. Dívida: se granularizar, criar `tags.manage-personal`.
- **`TicketNoteController.remove`**: check de admin mantido — é o único gate; remover afrouxaria.
- **`checkAdminOrSuper` extinto**: callers migrados — customFieldConfig/debug/maintenance/version(POST) → `settings.edit`; `/subscription` → `financeiro.edit`; `/tags/sync` → `contacts.edit-tags`.
- **`/admin-custom-fields`**: backend passou a exigir `settings.edit` (era checkAdminOrSuper); frontend alinhado.
- **`prompts.create/edit/delete`**: chaves mortas no catálogo (feature virou AI Agents); mantidas para não orfanar ACLs salvas.
- **`external-api.view`**: frontend-only por design — a API externa autentica por token (`isAuthCompany`).
- **Admin sem roles** → fallback blanket `getAdminPermissions()` (evita lockout de tenants antigos). Assimetria documentada: `getUserPermissions` sync mantém early-return admin (uso interno não-autorizativo); autorização real sempre passa por `hasPermissionAsync`.
- **Role "Administrador"**: protegida contra delete quando há admins vinculados; renomear ainda é possível (hardening futuro).
- **`TagServices/ListService`**: filtro de tags pessoais é código morto (condição contraditória `!userId`) — não alterado para não mudar comportamento; bug latente anotado.
- **Connections frontend**: `connections.create` gateando botões de editar/deletar — semanticamente errado, mantido (dívida).
