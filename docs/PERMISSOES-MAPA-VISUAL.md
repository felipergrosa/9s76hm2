# Mapa Visual de Permissoes

Data de referencia: 2026-03-13

Este mapa representa o estado atual das permissoes apos os ajustes em backend e frontend.

## 1. Hierarquia efetiva

```mermaid
flowchart TD
  SA["Superadmin"]
  AD["Admin"]
  US["User"]

  SA -->|"parametriza"| AD
  AD -->|"parametriza"| US

  SA --> SAFULL["100% das permissoes<br/>admin + super"]
  AD --> ADCUSTOM["Se permissions[] existir:<br/>usa exatamente o set parametrizado"]
  AD --> ADLEGACY["Se permissions[] estiver vazio:<br/>fallback para pacote admin legado"]
  US --> USBASE["Base user + permissions[] ou flags legadas"]
```

## 2. Fonte de verdade das permissoes

```mermaid
flowchart LR
  USERMODEL["User model<br/>profile / super / permissions[] / flags legadas"]
  PADAPTER["PermissionAdapter.getUserPermissions"]
  NORMALIZE["normalizePermissions<br/>edit/create/delete/upload -> view"]
  SERIALIZE["SerializeUser<br/>envia permissions[] ao frontend"]
  FRONT["Frontend<br/>usePermissions / Can / PrivateRoute"]
  BACK["Backend<br/>checkPermission / checkAdminOrSuper"]

  USERMODEL --> PADAPTER
  PADAPTER --> NORMALIZE
  NORMALIZE --> SERIALIZE
  SERIALIZE --> FRONT
  NORMALIZE --> BACK
```

## 3. Regra atual por perfil

```mermaid
flowchart TD
  SA["super = true"] --> SA1["Sempre passa em qualquer permissao"]
  SA --> SA2["Companies.*"]
  SA --> SA3["all-connections.view"]

  AD["profile = admin"] --> AD1["Se permissions[] definido:<br/>respeita apenas o set parametrizado"]
  AD --> AD2["Se permissions[] vazio:<br/>recebe todas as permissoes admin"]

  US["profile != admin e super != true"] --> US1["Se permissions[] definido:<br/>respeita o set parametrizado"]
  US --> US2["Se permissions[] vazio:<br/>base user + flags legadas"]
```

## 4. Carteiras e visibilidade de contatos/tickets

Carteira = contatos que possuem pelo menos uma tag pessoal com prefixo `#`.

```mermaid
flowchart TD
  CONTACT["Contato"]
  TAG["Tag pessoal<br/>#nome-do-usuario"]
  OWNER["allowedContactTags[] do usuario"]
  MANAGED["managedUserIds[] do supervisor"]
  MODE["supervisorViewMode<br/>include | exclude"]
  WALLET["GetUserWalletContactIds"]
  FILTER["Filtro em contatos e tickets"]

  CONTACT --> TAG
  TAG --> WALLET
  OWNER --> WALLET
  MANAGED --> WALLET
  MODE --> WALLET
  WALLET --> FILTER
```

### Resultado esperado da carteira

```mermaid
flowchart TD
  SA["Superadmin"] --> ALL["Ve tudo"]

  AD["Admin"] --> Q1{"permissions[] customizado?"}
  Q1 -->|Sim| Q2["Ve o que foi liberado + aplica regra de carteira/supervisao"]
  Q1 -->|Nao| Q3["Pacote admin legado + carteira/supervisao"]

  SUP["Supervisor"] --> SUP1["Sua carteira (# proprias)"]
  SUP --> SUP2["+ carteiras dos usuarios em managedUserIds quando include"]
  SUP --> SUP3["ou tudo exceto managedUserIds quando exclude"]

  SELL["User/Vendedor"] --> SELL1["Ve apenas contatos/tickets da propria carteira"]
```

## 5. Camadas de bloqueio

```mermaid
flowchart LR
  LOGIN["Usuario autenticado"]
  ROUTE["PrivateRoute no frontend"]
  UI["Can / usePermissions"]
  API["checkPermission no backend"]
  DATA["Filtro de carteira<br/>tags # / managedUserIds"]

  LOGIN --> ROUTE
  ROUTE --> UI
  UI --> API
  API --> DATA
```

Leitura do fluxo:

- `PrivateRoute` bloqueia o acesso antes de renderizar paginas sensiveis.
- `Can` e `usePermissions` escondem botoes e acoes no frontend.
- `checkPermission` protege as rotas da API.
- `GetUserWalletContactIds` restringe visibilidade operacional por carteira.

## 6. Modulos protegidos por permissao

```mermaid
flowchart TD
  ROOT["Permissoes do sistema"]

  ROOT --> T["Tickets"]
  ROOT --> C["Contatos"]
  ROOT --> CAMP["Campanhas"]
  ROOT --> FLOW["Flowbuilder"]
  ROOT --> MOD["Modulos"]
  ROOT --> ADM["Administracao"]
  ROOT --> SUP["Super"]

  T --> T1["tickets.view/create/update/transfer/close/delete"]
  T --> T2["tickets.view-all / view-groups / view-all-historic / view-all-users"]

  C --> C1["contacts.view/create/edit/delete/import/export/bulk-edit"]
  C --> C2["contacts.edit-fields / edit-tags / edit-wallets / edit-representative"]
  C --> C3["tags.view/create/edit/delete"]

  CAMP --> CP1["campaigns.view/create/edit/delete"]
  CAMP --> CP2["contact-lists.view/create/edit/delete"]
  CAMP --> CP3["campaigns-config.view"]

  FLOW --> F1["flowbuilder.view/create/edit/delete"]
  FLOW --> F2["phrase-campaigns.view/create/edit/delete"]

  MOD --> M1["kanban.view"]
  MOD --> M2["schedules.view/create/edit/delete"]
  MOD --> M3["internal-chat.view / integrations.view / prompts.* / ai-agents.* / ai-training.view"]
  MOD --> M4["announcements.view/create/edit/delete"]

  ADM --> A1["users.view/create/edit/delete"]
  ADM --> A2["queues.view/create/edit/delete"]
  ADM --> A3["connections.view/create/edit/delete"]
  ADM --> A4["files.view/upload/delete"]
  ADM --> A5["financeiro.view / settings.view/edit / ai-settings.view/edit"]

  SUP --> S1["companies.view/create/edit/delete"]
  SUP --> S2["all-connections.view"]
```

## 7. Rotas frontend hoje com bloqueio antecipado

Rotas principais ja cobertas por `PrivateRoute`:

- `/companies`, `/financeiro`, `/connections`, `/quick-messages`
- `/schedules`, `/tags`, `/contacts`, `/contacts/import`, `/groups`
- `/helps`, `/users`, `/settings`, `/queues`, `/reports`
- `/queue-integration`, `/announcements`, `/phrase-lists`
- `/flowbuilders`, `/flowbuilder/:id?`, `/files`
- `/Kanban`, `/TagsKanban`, `/allConnections`
- `/ai-settings`, `/ai-agents`, `/ai-training`
- `/contact-lists`, `/contact-lists/:contactListId/contacts`
- `/campaigns`, `/campaign/:campaignId/detailed-report`, `/campaigns-config`

Rotas centrais que continuam por autenticacao simples:

- `/`
- `/tickets/:ticketId?`
- `/chats/:id?`
- `/moments`
- `/messages-api`
- tutoriais em `/helps/...`

Nesses casos, a seguranca principal continua no backend e nas checagens internas da tela.

## 8. Resumo operacional

```mermaid
flowchart TD
  SUPER["Superadmin"] --> PSET["Define permissions[] de admins"]
  PSET --> ADMIN["Admin"]
  ADMIN --> USET["Define permissions[] de users"]
  USET --> USER["User"]

  SUPER --> TAGS["Cria estrategia de tags pessoais #"]
  TAGS --> WALLET["Carteira do usuario"]
  WALLET --> TICKET["Visibilidade de tickets"]
  WALLET --> CONTACT["Visibilidade de contatos"]
```

