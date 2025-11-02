# ✅ FASE 1 COMPLETA: Infraestrutura de Permissões Granulares

## 📋 O que foi implementado

### 1. **Migration do Banco de Dados**
- ✅ Arquivo: `backend/src/database/migrations/20251102000000-add-permissions-to-users.ts`
- ✅ Adiciona coluna `permissions` (ARRAY de strings) na tabela `Users`
- ✅ Default: array vazio `[]`
- ✅ **Retrocompatível**: não remove nenhuma coluna existente

### 2. **Modelo User Atualizado**
- ✅ Arquivo: `backend/src/models/User.ts`
- ✅ Novo campo: `permissions: string[]`
- ✅ Mantém todos os campos antigos intactos (`profile`, `allTicket`, `showDashboard`, etc.)

### 3. **Helper PermissionAdapter**
- ✅ Arquivo: `backend/src/helpers/PermissionAdapter.ts`
- ✅ Funções principais:
  - `getUserPermissions(user)` - Converte perfil antigo em permissões se necessário
  - `hasPermission(user, permission)` - Verifica se usuário tem permissão específica
  - `hasAllPermissions(user, permissions[])` - Verifica se tem TODAS
  - `hasAnyPermission(user, permissions[])` - Verifica se tem QUALQUER uma
  - `getPermissionsCatalog()` - Retorna catálogo organizado para frontend
  
### 4. **Middleware de Permissões**
- ✅ Arquivo: `backend/src/middleware/checkPermission.ts`
- ✅ Middlewares disponíveis:
  - `checkPermission(permission)` - Bloqueia rota se não tiver permissão
  - `checkAnyPermission([permissions])` - Requer pelo menos uma
  - `checkAllPermissions([permissions])` - Requer todas
  - `attachUserToRequest` - Adiciona usuário completo ao request

### 5. **API de Permissões**
- ✅ Controller: `backend/src/controllers/PermissionController.ts`
- ✅ Rotas: `backend/src/routes/permissionRoutes.ts`
- ✅ Endpoints:
  - `GET /permissions/catalog` - Catálogo organizado por categoria
  - `GET /permissions/list` - Lista flat de todas permissões

### 6. **Serialização do Usuário**
- ✅ Arquivo: `backend/src/helpers/SerializeUser.ts`
- ✅ Agora inclui campo `permissions` no retorno
- ✅ Frontend recebe automaticamente as permissões do usuário ao fazer login

---

## 🔒 CATÁLOGO DE PERMISSÕES

### Categorias Implementadas

#### **Atendimento**
- `tickets.view`, `tickets.create`, `tickets.update`, `tickets.transfer`, `tickets.close`, `tickets.delete`

#### **Respostas Rápidas**
- `quick-messages.view`, `quick-messages.create`, `quick-messages.edit`, `quick-messages.delete`

#### **Contatos**
- `contacts.view`, `contacts.create`, `contacts.edit`, `contacts.delete`, `contacts.import`, `contacts.export`, `contacts.bulk-edit`

#### **Dashboard**
- `dashboard.view`, `reports.view`, `realtime.view`

#### **Campanhas** (Completo)
- `campaigns.view`, `campaigns.create`, `campaigns.edit`, `campaigns.delete`
- `contact-lists.view`, `contact-lists.create`, `contact-lists.edit`, `contact-lists.delete`
- `campaigns-config.view`

#### **Flowbuilder**
- `flowbuilder.view`, `flowbuilder.create`, `flowbuilder.edit`, `flowbuilder.delete`
- `phrase-campaigns.view`, `phrase-campaigns.create`, `phrase-campaigns.edit`, `phrase-campaigns.delete`

#### **Módulos Opcionais**
- `kanban.view`, `schedules.view`, `internal-chat.view`, `external-api.view`, `prompts.view`, `integrations.view`

#### **Administração**
- `users.*`, `queues.*`, `connections.*`, `files.*`, `financeiro.view`, `settings.*`, `ai-settings.*`

---

## 🚀 COMO APLICAR (TESTAGEM SEGURA)

### Passo 1: Rodar Migration
```bash
cd backend
npm run migrate
```

### Passo 2: Reiniciar Backend
```bash
npm run dev
```

### Passo 3: Testar API de Permissões
```bash
# Obter catálogo (use token válido)
curl -H "Authorization: Bearer SEU_TOKEN" \
  http://localhost:8080/permissions/catalog

# Obter lista flat
curl -H "Authorization: Bearer SEU_TOKEN" \
  http://localhost:8080/permissions/list
```

---

## ✅ RETROCOMPATIBILIDADE GARANTIDA

### Como funciona o fallback:

1. **Usuário com `permissions` definidas**: usa elas diretamente
2. **Usuário SEM `permissions`** (usuários antigos):
   - Se `super === true` → TODAS permissões (incluindo super)
   - Se `profile === "admin"` → Todas permissões administrativas
   - Se `profile === "user"` → Permissões básicas + flags antigas:
     - `allTicket === "enable"` → adiciona `tickets.update`, `tickets.transfer`
     - `showDashboard === "enabled"` → adiciona `dashboard.view`, `reports.view`
     - `allowConnections === "enabled"` → adiciona `connections.view`, `connections.edit`
     - E assim por diante...

### **NADA QUEBRA**
- ✅ Sistema antigo continua funcionando exatamente como antes
- ✅ Usuários existentes mantêm suas permissões
- ✅ Frontend antigo continua usando `user.profile === "admin"`
- ✅ Novo sistema convive pacificamente com o antigo

---

## 📌 EXEMPLO DE USO (Controllers)

### ANTES (Sistema Antigo)
```typescript
// UserController.ts
if (user.profile !== "admin") {
  throw new AppError("ERR_NO_PERMISSION", 403);
}
```

### DEPOIS (Novo Sistema - Gradual)
```typescript
import { hasPermission } from "../helpers/PermissionAdapter";

// UserController.ts
const user = await User.findByPk(req.user.id);
if (!hasPermission(user, "users.create")) {
  throw new AppError("ERR_NO_PERMISSION", 403);
}
```

### OU usando Middleware
```typescript
// userRoutes.ts
import { checkPermission } from "../middleware/checkPermission";

router.post("/users", 
  isAuth, 
  checkPermission("users.create"),  // 👈 Novo middleware
  UserController.store
);
```

---

## 🧪 TESTES RECOMENDADOS

### 1. Testar Login
- ✅ Faça login com usuário admin
- ✅ Verifique se campo `permissions` aparece no response
- ✅ Confirme que lista contém todas permissões de admin

### 2. Testar Usuário Comum
- ✅ Faça login com usuário comum (profile: "user")
- ✅ Verifique se `permissions` contém apenas permissões básicas
- ✅ Confirme que flags antigas (`showDashboard`) adicionam permissões corretas

### 3. Testar API de Catálogo
- ✅ Chame `/permissions/catalog`
- ✅ Verifique estrutura por categoria
- ✅ Confirme que labels e descriptions aparecem

### 4. Testar Super Admin
- ✅ Login com `super: true`
- ✅ Confirme que recebe TODAS permissões incluindo `companies.view`, `all-connections.view`

---

## 🔄 PRÓXIMAS ETAPAS (Fase 2)

Agora que a infraestrutura está pronta, as próximas etapas são:

1. **Frontend: Dual-List Component**
   - Criar componente `PermissionTransferList`
   - Integrar no `UserModal` (aba Permissões)

2. **Frontend: Hook usePermissions**
   - Criar hook para verificar permissões no frontend
   - Substituir `user.profile === "admin"` gradualmente

3. **Atualizar Menu e Rotas**
   - Usar `hasPermission()` no `MainListItems.js`
   - Esconder itens de menu baseado em permissões

4. **Script de Migração**
   - Migrar usuários existentes para novo formato
   - Converter flags antigas em permissões definitivas

---

## 🛡️ SEGURANÇA

- ✅ **Super admin** sempre tem todas permissões (não depende de array)
- ✅ Middleware valida no backend (frontend não pode burlar)
- ✅ Permissões são verificadas a cada request
- ✅ Tokens continuam funcionando normalmente

---

## 📝 ARQUIVOS CRIADOS/MODIFICADOS

### Criados
- `backend/src/database/migrations/20251102000000-add-permissions-to-users.ts`
- `backend/src/helpers/PermissionAdapter.ts`
- `backend/src/middleware/checkPermission.ts`
- `backend/src/controllers/PermissionController.ts`
- `backend/src/routes/permissionRoutes.ts`
- `PERMISSIONS-PHASE-1-COMPLETE.md` (este arquivo)

### Modificados
- `backend/src/models/User.ts` (adicionado campo `permissions`)
- `backend/src/helpers/SerializeUser.ts` (adicionado campo no retorno)
- `backend/src/routes/index.ts` (adicionado rota de permissões)

---

## ❓ DÚVIDAS COMUNS

**Q: Preciso migrar todos os usuários agora?**  
A: Não! O sistema funciona com fallback automático. Usuários antigos continuam usando perfil/flags.

**Q: Posso começar a usar `checkPermission()` nas rotas agora?**  
A: Sim! Mas recomendamos fazer gradualmente, testando cada rota alterada.

**Q: E se eu quiser voltar ao sistema antigo?**  
A: Basta rodar `npm run migrate:undo` que remove a coluna `permissions`. Tudo volta ao normal.

**Q: As flags antigas (`allTicket`, `showDashboard`) ainda funcionam?**  
A: Sim! Elas continuam funcionando e são convertidas automaticamente em permissões.

---

## ✅ CHECKLIST DE VALIDAÇÃO

- [x] Migration criada e testada
- [x] Modelo User atualizado
- [x] Helper PermissionAdapter funcionando
- [x] Middleware checkPermission criado
- [x] API de catálogo disponível
- [x] Serialização inclui permissions
- [x] Retrocompatibilidade garantida
- [ ] Testes unitários (Fase 1.5 - opcional)
- [ ] Documentação de API (Swagger - opcional)

---

**Status:** ✅ **FASE 1 COMPLETA E FUNCIONAL**  
**Próximo passo:** Implementar Fase 2 (Frontend Dual-List)
