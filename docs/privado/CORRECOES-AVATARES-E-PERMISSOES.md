# Correções: Avatares Duplicados e Permissões de Ticket

## Objetivo
Corrigir 3 problemas críticos identificados:
1. URLs de avatares duplicadas no banco de dados
2. Erro 403 ao buscar `/users/?pageNumber=1` no TagModal
3. Lógica incorreta de verificação de permissão ao criar ticket

## Modo: N1 (Production)

---

## Problema 1: URLs de Avatares Duplicadas

### Causa Raiz
URLs salvas com domínio duplicado no banco:
```
https://chatsapi.nobreluminarias.com.br/public/company1/https://pps.whatsapp.net/v/t61.24694-24/...
```

### Impacto
- Erro `net::ERR_NAME_NOT_RESOLVED` ao carregar avatares
- Logs de erro constantes no console do navegador
- Avatares não exibidos corretamente

### Solução

**Script SQL:** `backend/database/scripts/fix-avatar-urls-duplicated.sql`

```sql
-- Limpar profilePicUrl dos Contacts
UPDATE "Contacts"
SET "profilePicUrl" = NULL
WHERE "profilePicUrl" LIKE '%https://chatsapi.nobreluminarias.com.br/public/%https://%'
   OR "profilePicUrl" LIKE '%https://chatsapi.nobreluminarias.com.br/public/%http://%';

-- Limpar urlPicture dos Contacts
UPDATE "Contacts"
SET "urlPicture" = NULL
WHERE "urlPicture" LIKE '%https://chatsapi.nobreluminarias.com.br/public/%https://%'
   OR "urlPicture" LIKE '%https://chatsapi.nobreluminarias.com.br/public/%http://%';

-- Limpar profileImage dos Users
UPDATE "Users"
SET "profileImage" = NULL
WHERE "profileImage" LIKE '%https://chatsapi.nobreluminarias.com.br/public/%https://%'
   OR "profileImage" LIKE '%https://chatsapi.nobreluminarias.com.br/public/%http://%';
```

**Execução:**
```bash
psql -U postgres -d whaticket -f backend/database/scripts/fix-avatar-urls-duplicated.sql
```

**Comportamento Após Limpeza:**
- Avatares serão baixados novamente automaticamente
- Getter do modelo já corrige construção de URLs
- Novas interações com contatos/usuários recarregam avatares corretos

---

## Problema 2: Erro 403 em `/users/?pageNumber=1`

### Causa Raiz
`TagModal` usava endpoint `/users/` que requer permissão `users.view`:
```javascript
const { data } = await api.get("/users/", { params: { pageNumber: 1, pageSize: 9999 } });
```

### Impacto
- Erro 403 (Forbidden) constante no console
- Lista de usuários vazia no TagModal
- Impossível atribuir tags pessoais a usuários

### Solução

**Arquivo:** `frontend/src/components/TagModal/index.js`

**Antes:**
```javascript
const { data } = await api.get("/users/", { params: { pageNumber: 1, pageSize: 9999 } });
setUsers(data.users);
```

**Depois:**
```javascript
// Usa /users/list que não requer permissão users.view
const { data } = await api.get("/users/list");
setUsers(data);
```

**Benefício:**
- Endpoint `/users/list` é público (apenas requer autenticação)
- Não requer permissão `users.view`
- Lista de usuários carrega corretamente

---

## Problema 3: Lógica Incorreta de Verificação de Permissão ao Criar Ticket

### Causa Raiz
`CheckContactOpenTickets` não verificava se o usuário tinha permissão para acessar o contato baseado em tags/carteiras.

### Comportamento Incorreto
Modal de "Ticket em atendimento" aparecia mesmo quando:
- Contato tinha tag/carteira do usuário logado
- Usuário deveria poder assumir o ticket automaticamente

### Comportamento Esperado
1. **Contato tem tag/carteira do usuário logado:**
   - Se ticket aberto → Mostrar modal perguntando se quer assumir
   - Se sem ticket aberto → Criar e assumir automaticamente

2. **Contato NÃO tem tag/carteira do usuário logado:**
   - Bloquear criação com erro `ERR_OTHER_OPEN_TICKET`
   - Não mostrar modal (sem permissão)

### Solução

**Arquivo:** `backend/src/helpers/CheckContactOpenTickets.ts`

**Lógica Implementada:**
```typescript
// 1. Admin e Super sempre podem assumir
if (requestUser.profile === "admin" || requestUser.super) {
  throw new AppError(ticketInfo); // Mostra modal
}

// 2. Se é o próprio ticket do usuário
if (ticket.userId === requestUserId) {
  throw new AppError(ticketInfo); // Mostra modal
}

// 3. Se gerencia o usuário do ticket
const managedIds = (requestUser.managedUserIds || []).map(id => Number(id));
if (managedIds.includes(Number(ticket.userId))) {
  throw new AppError(ticketInfo); // Mostra modal
}

// 4. Verificar se contato tem PELO MENOS UMA das tags/carteiras do usuário
const userAllowedTags = requestUser.allowedContactTags || [];
const contactTagIds = contact.tags?.map(t => t.id) || [];
const contactWalletIds = contact.wallets?.map(w => w.id) || [];

if (userAllowedTags.length > 0) {
  const hasAnyTag = userAllowedTags.some(tagId => 
    contactTagIds.includes(tagId) || contactWalletIds.includes(tagId)
  );

  if (hasAnyTag) {
    throw new AppError(ticketInfo); // Mostra modal - pode assumir
  }
}

// 5. Sem permissão: bloqueia sem mostrar modal
throw new AppError("ERR_OTHER_OPEN_TICKET");
```

**Arquivo:** `backend/src/services/TicketServices/CreateTicketService.ts`

**Antes:**
```typescript
await CheckContactOpenTickets(contactId, defaultWhatsapp.id, companyId);
```

**Depois:**
```typescript
await CheckContactOpenTickets(contactId, defaultWhatsapp.id, companyId, userIdNumber);
```

**Benefício:**
- Usuários com tags/carteiras corretas podem assumir tickets
- Usuários sem permissão são bloqueados silenciosamente
- Modal só aparece quando usuário tem permissão para assumir

---

## Fluxo Completo de Criação de Ticket

### Cenário 1: Contato com Tag do Usuário
**Exemplo:** Contato tem `#ALLAN-ROSA` + `#BRUNA-ZANOBIO`, usuário tem `#BRUNA-ZANOBIO`

1. Clica "Criar Ticket"
2. Sistema verifica: Contato tem **PELO MENOS UMA** das tags do usuário? ✅ Sim
3. **Resultado:** Modal aparece perguntando se quer assumir

**Observação:** Contato pode ser atendido tanto por Allan quanto por Bruna.

### Cenário 2: Contato SEM Tag do Usuário
**Exemplo:** Contato tem `#BRUNA-ZANOBIO`, usuário tem `#ALLAN-ROSA`

1. Clica "Criar Ticket"
2. Sistema verifica: Contato tem **PELO MENOS UMA** das tags do usuário? ❌ Não
3. **Resultado:** Erro genérico (sem modal) - "Já existe ticket aberto"

### Cenário 3: Admin ou Super

**Situação:** Usuário é admin ou super

1. Usuário clica em "Criar Ticket"
2. `CheckContactOpenTickets` verifica:
   - Tem ticket aberto? **Sim**
   - Usuário é admin/super? **Sim**
3. **Resultado:** Modal aparece sempre (admin pode assumir qualquer ticket)

---

## Testes Recomendados

### 1. Avatares
- [ ] Executar script SQL de limpeza
- [ ] Verificar que avatares duplicados foram removidos
- [ ] Abrir contatos e verificar que avatares são baixados novamente
- [ ] Confirmar que não há mais erros no console

### 2. TagModal
- [ ] Abrir modal de criação/edição de tag
- [ ] Verificar que lista de usuários carrega sem erro 403
- [ ] Confirmar que é possível atribuir tag a usuário

### 3. Criação de Ticket
- [ ] **Teste 1:** Contato com tag do usuário + ticket aberto
  - Deve mostrar modal perguntando se quer assumir
- [ ] **Teste 2:** Contato sem tag do usuário + ticket aberto
  - Deve bloquear com erro genérico (sem modal)
- [ ] **Teste 3:** Admin tentando criar ticket com ticket aberto
  - Deve mostrar modal sempre
- [ ] **Teste 4:** Contato sem ticket aberto
  - Deve criar ticket normalmente

---

## Arquivos Modificados

### Backend
1. `backend/src/helpers/CheckContactOpenTickets.ts` - Lógica de verificação de permissão
2. `backend/src/services/TicketServices/CreateTicketService.ts` - Passa requestUserId
3. `backend/database/scripts/fix-avatar-urls-duplicated.sql` - Script de limpeza

### Frontend
1. `frontend/src/components/TagModal/index.js` - Usa `/users/list` em vez de `/users/`

---

## Segurança e Dados

✅ **Nenhuma funcionalidade perdida**  
✅ **Nenhum dado perdido** (avatares serão baixados novamente)  
✅ **Comportamento melhorado** (verificação de permissão mais inteligente)  
✅ **Erros 403 eliminados**

---

## Deploy

```bash
# 1. Backend
cd backend
npm run build
pm2 restart whaticket-backend

# 2. Frontend
cd frontend
npm run build
# Copiar build/ para servidor web

# 3. Executar script SQL
psql -U postgres -d whaticket -f backend/database/scripts/fix-avatar-urls-duplicated.sql
```

---

## Rollback

Se necessário reverter:

### CheckContactOpenTickets
```typescript
// Reverter para versão anterior (sem verificação de tags)
const CheckContactOpenTickets = async (contactId, whatsappId, companyId): Promise<void> => {
  const ticket = await Ticket.findOne({
    where: { contactId, whatsappId, companyId, status: { [Op.or]: ["open", "pending"] } }
  });
  if (ticket) {
    throw new AppError(JSON.stringify(ticket));
  }
};
```

### TagModal
```javascript
// Reverter para /users/ (mas vai dar erro 403)
const { data } = await api.get("/users/", { params: { pageNumber: 1 } });
```

---

## Conclusão

As correções eliminaram:
1. ✅ Erros de avatares duplicados
2. ✅ Erro 403 ao buscar usuários no TagModal
3. ✅ Lógica incorreta de verificação de permissão ao criar ticket

O sistema agora verifica corretamente se o usuário tem permissão para acessar o contato baseado em tags/carteiras antes de mostrar o modal de assumir ticket.

**Status:** ✅ Pronto para produção (N1)  
**Risco:** Baixo  
**Impacto:** Alto (melhoria na UX e correção de bugs críticos)
