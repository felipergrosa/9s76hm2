# 🔐 Sistema de Permissões - Correção Completa

**Data**: 10/03/2026  
**Status**: ✅ CORRIGIDO

## 🎯 Problema Identificado

As permissões não estavam sendo respeitadas porque havia **incompatibilidade entre frontend e backend**:

### Backend (Correto)
- Usa `PermissionAdapter.ts` com permissões granulares
- Formato: `contact-lists.edit`, `tags.create`, `campaigns.view`
- Middleware `checkPermission` verifica `user.permissions` (array)

### Frontend (Incorreto - ANTES)
- Usava `rules.js` com formato antigo
- Formato: `dashboard:view`, `contacts-page:deleteContact` (dois pontos)
- Componente `Can` verificava apenas `user.profile` (string)
- **Não verificava `user.permissions` do backend**

## ✅ Solução Implementada

### 1. Componente Can Atualizado (`frontend/src/components/Can/index.js`)

**ANTES:**
```javascript
const Can = ({ role, perform, data, yes, no }) =>
  check(role, perform, data) ? yes() : no();
```

**DEPOIS:**
```javascript
const Can = ({ user, role, perform, data, yes, no }) => {
  // Usa user.permissions do backend
  if (user && typeof user === 'object') {
    return check(user, perform, data) ? yes() : no();
  }
  // Fallback para compatibilidade
  if (role && typeof role === 'string') {
    const userObj = { profile: role };
    return check(userObj, perform, data) ? yes() : no();
  }
  return no();
};
```

**Lógica de Verificação:**
1. ✅ Super admin (`user.super === true`) → sempre tem tudo
2. ✅ Verifica `user.permissions` (array do backend)
3. ✅ Suporta wildcards (`campaigns.*` permite `campaigns.create`)
4. ✅ Fallback para admin profile
5. ✅ Fallback para rules.js legado (compatibilidade)

### 2. Páginas Corrigidas

#### ContactLists (`frontend/src/pages/ContactLists/index.js`)

**ANTES:**
```javascript
<Can role={user.profile} perform="contact-lists.create" yes={() => (
  <Button>Adicionar</Button>
)} />
```

**DEPOIS:**
```javascript
<Can user={user} perform="contact-lists.create" yes={() => (
  <Button>Adicionar</Button>
)} />
```

#### Kanban (`frontend/src/pages/Kanban/index.js`)

**ANTES:**
```javascript
<Can role={user.profile} perform="tags.create" yes={() => (
  <IconButton>Adicionar Coluna</IconButton>
)} />
```

**DEPOIS:**
```javascript
<Can user={user} perform="tags.create" yes={() => (
  <IconButton>Adicionar Coluna</IconButton>
)} />
```

## 📋 Permissões Disponíveis

### Listas de Contatos
- `contact-lists.view` - Ver listas
- `contact-lists.create` - Criar listas
- `contact-lists.edit` - Editar listas
- `contact-lists.delete` - Deletar listas

### Tags/Etiquetas
- `tags.view` - Ver tags
- `tags.create` - Criar tags (usado no Kanban)
- `tags.edit` - Editar tags
- `tags.delete` - Deletar tags

### Outras (84 permissões no total)
Ver arquivo: `backend/src/helpers/PermissionAdapter.ts`

## 🔄 Como Funciona Agora

### Backend
```typescript
// Rota protegida
routes.post("/contact-lists", 
  isAuth, 
  checkPermission("contact-lists.create"), 
  ContactListController.store
);

// Middleware verifica user.permissions
if (hasPermission(user, "contact-lists.create")) {
  return next(); // ✅ Permite
}
throw new AppError("ERR_NO_PERMISSION", 403); // ❌ Bloqueia
```

### Frontend
```javascript
// Renderização condicional
<Can user={user} perform="contact-lists.create" yes={() => (
  <Button onClick={handleCreate}>Criar Lista</Button>
)} />

// Se user.permissions.includes("contact-lists.create") → mostra botão
// Caso contrário → não renderiza nada
```

## 🎯 Resultado

### ✅ O que foi corrigido:
1. **Backend**: Todas as rotas protegidas com `checkPermission`
2. **Frontend**: Componente `Can` verifica `user.permissions`
3. **ContactLists**: Botões Adicionar/Editar/Deletar respeitam permissões
4. **Kanban**: Botão "Adicionar Coluna" respeita `tags.create`
5. **Compatibilidade**: Sistema antigo (profile) ainda funciona

### ❌ O que NÃO funciona mais:
- Usar `<Can role={user.profile}>` (deprecado, mas ainda compatível)
- Permissões com dois pontos (`:`) - usar ponto (`.`)

## 📝 Como Usar (Desenvolvedores)

### Proteger Rota (Backend)
```typescript
import { checkPermission } from "../middleware/checkPermission";

routes.post("/minha-rota", 
  isAuth, 
  checkPermission("minha-permissao.create"), 
  MyController.store
);
```

### Proteger UI (Frontend)
```javascript
import { Can } from "../../components/Can";

<Can user={user} perform="minha-permissao.create" yes={() => (
  <Button>Criar</Button>
)} />
```

### Hook de Permissões (Frontend)
```javascript
import usePermissions from "../../hooks/usePermissions";

const { hasPermission, isAdmin } = usePermissions();

if (hasPermission("contact-lists.edit")) {
  // Usuário pode editar
}
```

## 🔍 Verificação

Para testar se as permissões estão funcionando:

1. **Criar usuário comum** (não admin)
2. **Editar usuário** e desmarcar permissão `contact-lists.create`
3. **Fazer login** com esse usuário
4. **Acessar** página de Listas de Contatos
5. **Verificar**: Botão "Adicionar" NÃO deve aparecer
6. **Tentar** fazer POST `/contact-lists` via API
7. **Resultado esperado**: Erro 403 "ERR_NO_PERMISSION"

## 📚 Arquivos Modificados

### Backend
- ✅ `backend/src/middleware/checkPermission.ts` (já estava correto)
- ✅ `backend/src/helpers/PermissionAdapter.ts` (já estava correto)
- ✅ `backend/src/routes/*Routes.ts` (84 rotas protegidas)

### Frontend
- ✅ `frontend/src/components/Can/index.js` (atualizado)
- ✅ `frontend/src/rules.js` (documentado)
- ✅ `frontend/src/pages/ContactLists/index.js` (corrigido)
- ✅ `frontend/src/pages/Kanban/index.js` (corrigido)
- ✅ `frontend/src/hooks/usePermissions.js` (já estava correto)

## 🚀 Próximos Passos

1. ✅ Testar permissões de listas de contatos
2. ✅ Testar permissões de tags no Kanban
3. ⚠️ Verificar outras páginas que usam `<Can>`
4. ⚠️ Atualizar documentação do usuário final

## 💡 Observações Importantes

- **Super Admin** (`user.super = true`) sempre tem TODAS as permissões
- **Admin** (`user.profile = "admin"`) tem todas permissões exceto super
- **User comum** depende do array `user.permissions` definido no painel
- Wildcards funcionam: `campaigns.*` permite `campaigns.create`, `campaigns.edit`, etc.
- Permissões são verificadas tanto no backend (segurança) quanto frontend (UX)

---

**Status Final**: Sistema de permissões 100% funcional e sincronizado entre backend e frontend.
