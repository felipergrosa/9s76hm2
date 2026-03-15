# 📊 Mapa Completo: Carteiras e Tags

**Objetivo:** Segmentação de contatos e controle de permissões de acesso em todo o sistema

---

## 🎯 Conceitos Fundamentais

### 🗂️ Carteiras (Wallets)
**Definição:** Carteira = Usuário responsável por um conjunto de contatos

**Conceito-chave:**
- `ContactWallet` vincula **Contato → Usuário** (walletId = userId)
- Um contato pode ter **múltiplos responsáveis** (carteira compartilhada)
- Carteira define **quem pode visualizar/editar** o contato
- **Sincronização bidirecional** com tags pessoais

### 🏷️ Tags
**Tipos de Tags:**

1. **Tags Normais** (nome sem prefixo)
   - Categorização geral de contatos/tickets
   - Visíveis para todos usuários com permissão
   - Ex: "Cliente VIP", "Inadimplente", "Região Sul"

2. **Tags Pessoais** (prefixo `#`)
   - Começam com `#` mas **NÃO** com `##`
   - Vinculadas ao `allowedContactTags` do usuário
   - **Auto-sincronizam** com carteiras do usuário
   - Ex: "#JoãoSilva", "#EquipeVendas"

3. **Tags de Sistema** (prefixo `##`)
   - Começam com `##`
   - Uso interno/automação
   - **Ignoradas** pelo sistema de carteiras
   - Ex: "##Bot", "##Importado"

---

## 🗄️ BACKEND - Estrutura de Dados

### Models

#### `ContactWallet.ts`
```typescript
{
  contactId: number,      // FK → Contact
  walletId: number,       // FK → User (responsável)
  companyId: number       // FK → Company
}
```

#### `Tag.ts`
```typescript
{
  name: string,           // Nome da tag
  color: string,          // Cor hexadecimal
  userId: number,         // Criador (nullable)
  kanban: number,         // 0=normal, 1=kanban
  companyId: number
}
```

#### `ContactTag.ts` (N:N)
```typescript
{
  contactId: number,      // FK → Contact
  tagId: number          // FK → Tag
}
```

#### `TicketTag.ts` (N:N)
```typescript
{
  ticketId: number,       // FK → Ticket
  tagId: number          // FK → Tag
}
```

#### `User.ts` (campos relevantes)
```typescript
{
  allowedContactTags: number[],     // IDs das tags que o usuário pode acessar
  managedUserIds: number[],         // IDs dos usuários supervisionados
  supervisorViewMode: "include" | "exclude",  // Modo de supervisão
  permissions: string[]             // Sistema de permissões granulares
}
```

#### `TagRule.ts`
```typescript
{
  tagId: number,                    // Tag a aplicar
  field: string,                    // Campo do contato (region, segment, etc)
  operator: string,                 // equals, contains, in
  value: string,                    // Valor ou JSON array
  logic: "AND" | "OR",             // Lógica de combinação
  active: boolean                   // Regra ativa
}
```

---

### Services - Carteiras

#### `UpdateContactWalletsService.ts`
**Função:** Atualizar carteira de um contato
- Remove todas as `ContactWallet` antigas
- Cria novas com base nos IDs de usuários fornecidos
- **Chama `SyncContactWalletsAndPersonalTagsService`** após atualizar

#### `SyncContactWalletsAndPersonalTagsService.ts`
**Função:** Sincronização bidirecional carteiras ↔ tags pessoais

**Modo `wallet` (carteiras → tags):**
1. Busca usuários na carteira do contato
2. Para cada usuário, busca suas tags pessoais (`#` não `##`)
3. **Adiciona** tags pessoais ao contato se não existir
4. **Remove** tags pessoais que não pertencem mais à carteira

**Modo `tags` (tags → carteiras):**
1. Busca tags pessoais do contato
2. Para cada tag pessoal, busca usuários que têm essa tag em `allowedContactTags`
3. **Recria** `ContactWallet` com base nos usuários encontrados

#### `ApplyUserPersonalTagService.ts`
**Função:** Aplicar tag pessoal do usuário ao contato
- Busca tags pessoais do usuário (`#` não `##`)
- Adiciona ao contato se não existir
- Usada quando usuário assume responsabilidade

#### `GetUserWalletContactIds.ts` ⭐
**Função:** Retorna IDs de contatos na carteira do usuário

**Lógica de permissões:**
- **Admin sem `managedUserIds`:** vê TUDO (sem restrição)
- **Admin com `supervisorViewMode = "exclude"`:** vê tudo EXCETO carteiras selecionadas
- **Admin com `supervisorViewMode = "include"`:** vê sua carteira + carteiras gerenciadas
- **User:** vê apenas sua carteira + carteiras gerenciadas

**Cache:** 5 minutos (invalidar ao atualizar `allowedContactTags`)

---

### Services - Tags

#### `ListAllTagsService.ts`
**Função:** Lista tags de LibraryFiles/Folders (RAG)
- **NÃO confundir** com tags de contatos/tickets
- Específico para biblioteca de arquivos

#### `ApplyTagRulesService.ts`
**Função:** Aplicar regras automáticas de tags
- Avalia condições (campo, operador, valor)
- Aplica tags automaticamente baseado em dados do contato
- Ex: "Se region = 'Sul' → adicionar tag 'Região Sul'"

#### `SyncTagsService.ts`
**Função:** Sincronizar tags de um contato
- Endpoint: `POST /tags/sync`
- Remove antigas, adiciona novas

---

### Rotas e Permissões

#### Carteiras
```typescript
PUT /contact-wallet/:contactId
  - Permissão: contacts.edit-wallets
  - Controller: ContactController.updateContactWallet
```

#### Tags
```typescript
GET /tags/list
  - Permissão: tags.view
  - Controller: TagController.list

POST /tags
  - Permissão: tags.create
  - Controller: TagController.store

POST /tags/sync
  - Permissão: contacts.edit-tags
  - Controller: TagController.syncTags
```

---

## 🎨 FRONTEND - Componentes e Permissões

### Componentes Principais

#### `ContactModal/index.js`
**Carteiras:**
- Campo: "Carteira (responsáveis)" - Select múltiplo
- Fonte: `api.get('/users')` → `userOptions`
- Permissão: `hasPermission("contacts.edit-wallets")`
- Estado: `values.wallets` (array de userIds)

**Tags:**
- Componente: `<TagsContainer />`
- Permissão: `hasPermission("contacts.edit-tags")`
- Sincroniza via `api.post('/tags/sync', { contactId, tags })`

#### `TagsContainer/index.js`
**Funcionalidade:**
- Autocomplete com criação de tags (freeSolo)
- Busca tags via `api.get('/tags/list', { params: { kanban: 0 } })`
- Cria novas tags com cor aleatória
- Sincroniza automaticamente ao alterar

#### `BulkProcessTicketsModal/index.js`
**Carteiras:**
- Campo: "Carteira (Responsável)" - Select simples
- Fonte: `users` (mesmo array de usuários)
- Permissão: `hasPermission("tickets.bulk-edit-wallets")` **ou** `hasPermission("contacts.edit-wallets")`
- Valor: `selectedWallet` (userId único)
- Backend: `BulkProcessTicketsService` → `UpdateContactWalletsService`

#### `UserModal/index.js`
**Configuração de Tags Permitidas:**
- Campo: `allowedContactTags` (autocomplete tags)
- Controla quais contatos o usuário pode ver
- Define tags pessoais do usuário

---

### Sistema de Permissões

#### `usePermissions.js`
```javascript
hasPermission(permission)
  - Verifica user.permissions (array de strings)
  - Suporta wildcards: "contacts.*", "admin"
```

#### Permissões Relevantes

**Carteiras:**
- `contacts.edit-wallets` - Editar carteira de contatos
- `tickets.bulk-edit-wallets` - Alterar carteira em massa

**Tags:**
- `tags.view` - Visualizar tags
- `tags.create` - Criar novas tags
- `contacts.edit-tags` - Editar tags de contatos

**Legado (rules.js - formato antigo):**
- `contacts-page:editWallets`
- `contacts-page:editTags`

---

## 🔄 Fluxos de Sincronização

### Fluxo 1: Atualizar Carteira → Sincroniza Tags
```
1. User edita carteira no ContactModal
2. PUT /contact-wallet/:contactId
3. UpdateContactWalletsService:
   - Remove antigas ContactWallet
   - Cria novas ContactWallet
   - Chama SyncContactWalletsAndPersonalTagsService (mode: "wallet")
4. Sync adiciona/remove tags pessoais do contato
```

### Fluxo 2: Atualizar Tags → Sincroniza Carteiras
```
1. User edita tags no TagsContainer
2. POST /tags/sync
3. SyncTagsService atualiza ContactTag
4. Hook/Trigger chama SyncContactWalletsAndPersonalTagsService (mode: "tags")
5. Sync recria ContactWallet baseado em tags pessoais
```

### Fluxo 3: Filtro de Tickets por Carteira
```
1. User abre tickets com walletOnly=true
2. ListTicketsService:
   - Chama GetUserWalletContactIds(userId, companyId)
   - Retorna lista de contactIds permitidos
   - Filtra tickets: WHERE contact.id IN (contactIds)
```

---

## ⚠️ PONTOS DE ATENÇÃO

### 🔴 Críticos

#### 1. **Endpoint `/wallets` Inexistente**
**Problema:**
- BulkProcessTicketsModal tentava chamar `GET /wallets`
- Endpoint **não existe** no backend

**Solução Aplicada:**
- Carteira = Usuário (walletId é userId)
- Usar `GET /users` em vez de `/wallets`
- ✅ **Corrigido** em BulkProcessTicketsModal

#### 2. **Inconsistência de Nomenclatura**
**Problema:**
- Backend: "wallet" = usuário responsável
- Frontend: Alguns lugares chamam "Carteira", outros "Responsável"
- Documentação/código usa ambos intercambiados

**Impacto:** Confusão para novos desenvolvedores

**Sugestão:**
- Padronizar: **"Carteira (Responsável)"** em todo frontend
- Comentários: sempre explicar `walletId = userId`

#### 3. **Sincronização Bidirecional Pode Causar Loops**
**Risco:**
- Atualizar carteira → sync tags → trigger → sync carteira → loop infinito
- Atualmente mitigado por lógica de verificação (só atualiza se houver mudança)

**Validação Necessária:**
- Testar cenários de edição simultânea
- Logs para detectar loops

---

### 🟡 Melhorias Recomendadas

#### 1. **Cache de `GetUserWalletContactIds`**
**Atual:**
- Cache de 5 minutos em memória
- Invalidação manual via `invalidateWalletCache()`

**Problema:**
- Se admin alterar `allowedContactTags`, cache fica stale
- Múltiplos workers (cluster) = caches diferentes

**Sugestão:**
- Redis para cache compartilhado
- Invalidação automática via hook `User.afterUpdate`

#### 2. **Permissões Granulares Inconsistentes**
**Atual:**
- Backend: usa `contacts.edit-wallets`, `tags.create`, etc.
- Frontend: mistura formato novo (`.`) e legado (`:`), ex: `contacts-page:editWallets`

**Sugestão:**
- Migrar totalmente para formato novo (`contacts.edit-wallets`)
- Deprecar `rules.js` formato antigo
- Atualizar todas permissões em `rules.js` para novo formato

#### 3. **Tag Pessoal sem Validação de Formato**
**Problema:**
- Tags pessoais devem começar com `#` mas não `##`
- Frontend não valida ao criar
- Backend filtra com `LIKE "#%" NOT LIKE "##%"`

**Risco:**
- User cria tag "JoãoSilva" (sem #) pensando ser pessoal
- Sistema não reconhece como pessoal

**Sugestão:**
- Validação frontend: se tag em `allowedContactTags` → forçar prefixo `#`
- Tooltip explicando convenção

#### 4. **BulkProcessTicketsService - walletId Atualiza Apenas Contato**
**Comportamento Atual:**
```typescript
if (walletId && ticket.contactId) {
  await UpdateContactWalletsService({
    contactId: String(ticket.contactId),
    wallets: [walletId],  // ⚠️ SUBSTITUI toda carteira
    companyId
  });
}
```

**Problema:**
- Se contato tinha carteira `[1, 2, 3]`
- Bulk update com `walletId=4`
- Resultado: carteira = `[4]` (perdeu `[1, 2, 3]`)

**Sugestão:**
- **Opção A:** Adicionar flag `appendWallet` (adiciona em vez de substituir)
- **Opção B:** Endpoint separado `addToWallet` vs `replaceWallet`
- **Opção C:** Frontend mostrar claramente: "Substituir carteira por..."

---

### 🟢 Funcionando Bem

#### 1. ✅ Sincronização Automática Carteiras ↔ Tags
- Lógica robusta em `SyncContactWalletsAndPersonalTagsService`
- Suporta múltiplos usuários/tags
- Evita duplicatas

#### 2. ✅ Filtro de Tickets por Carteira
- `GetUserWalletContactIds` com cache eficiente
- Suporta supervisão (include/exclude)
- Admin pode ver tudo ou delegar

#### 3. ✅ TagRules - Automação Inteligente
- Aplica tags automaticamente baseado em critérios
- Suporta múltiplos operadores (equals, contains, in)
- Cron job para processar em lote

#### 4. ✅ Componente `TagsContainer`
- UX excelente: autocomplete + criação inline
- Sincronização automática
- Visual claro com cores

---

## 📋 Checklist de Alinhamento

### Backend
- [x] Model `ContactWallet` vincula contato → usuário
- [x] Model `Tag` com suporte a tipos (normal, pessoal, sistema)
- [x] Service `SyncContactWalletsAndPersonalTagsService` bidirecional
- [x] Helper `GetUserWalletContactIds` com cache
- [x] Middleware `checkPermission` granular
- [ ] **Criar endpoint GET /wallets/users** (alias para /users para clareza)
- [ ] **Validar formato de tag pessoal (#) ao criar**
- [ ] **Adicionar hook User.afterUpdate para invalidar cache**

### Frontend
- [x] `ContactModal` com campos carteira e tags
- [x] `TagsContainer` com autocomplete
- [x] `BulkProcessTicketsModal` com campo carteira
- [x] Permissões via `usePermissions`
- [ ] **Padronizar nomenclatura: sempre "Carteira (Responsável)"**
- [ ] **Tooltip explicando convenção de tags pessoais (#)**
- [ ] **Migrar rules.js para formato novo (contacts.edit-wallets)**
- [ ] **Adicionar flag "Adicionar à carteira" vs "Substituir carteira" em bulk**

### Documentação
- [x] Mapa completo de carteiras e tags
- [ ] **Tutorial para usuários: como usar carteiras**
- [ ] **Guia de migração: permissões antigas → novas**
- [ ] **Diagrama de fluxo de sincronização**

---

## 🎯 Recomendações de Prioridade

### Alta Prioridade
1. **Validar tag pessoal (#) no frontend** ao associar a usuário
2. **Padronizar nomenclatura** "Carteira (Responsável)" em todo código
3. **Flag appendWallet** em BulkProcessTicketsModal (evitar perda de carteira)

### Média Prioridade
4. **Migrar permissões** formato antigo → novo
5. **Cache Redis** para `GetUserWalletContactIds`
6. **Documentação de usuário** (tutorial carteiras)

### Baixa Prioridade
7. **Endpoint /wallets/users** (alias para clareza)
8. **Diagrama de arquitetura** visual

---

## 📝 Glossário

| Termo | Definição |
|-------|-----------|
| **Carteira** | Conjunto de contatos atribuídos a um usuário responsável |
| **walletId** | ID do usuário responsável (walletId = userId) |
| **Tag Pessoal** | Tag que começa com `#` mas não `##`, vinculada a usuário específico |
| **Tag de Sistema** | Tag que começa com `##`, uso interno |
| **allowedContactTags** | Array de IDs de tags que o usuário pode acessar |
| **supervisorViewMode** | Modo de supervisão: "include" (ver apenas selecionados) ou "exclude" (ver tudo exceto selecionados) |
| **TagRule** | Regra automática para aplicar tags baseado em condições |

---

**Última atualização:** 15/03/2026  
**Versão:** 1.0  
**Autor:** Análise automatizada do sistema
