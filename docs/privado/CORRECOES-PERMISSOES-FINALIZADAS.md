# Correções de Permissões Finalizadas

## Objetivo
Unificar lógica de permissão em todo o sistema: **PELO MENOS UMA** tag em vez de **TODAS** as tags.

## Modo: N1 (Production)

---

## ✅ Correções Aplicadas

### 1. ListContactsService.ts

**Arquivo:** `backend/src/services/ContactServices/ListContactsService.ts`

**Antes:**
```typescript
// REGRA: O contato deve ter TODAS as tags que o usuário possui
const contactsWithAllTags = await ContactTag.findAll({
  where: { tagId: { [Op.in]: allowedTagIds } },
  attributes: ["contactId"],
  group: ["contactId"],
  having: literal(`COUNT(DISTINCT "tagId") = ${allowedTagIds.length}`),
  raw: true
});
```

**Depois:**
```typescript
// REGRA: O contato deve ter PELO MENOS UMA das tags que o usuário possui
const contactsWithAnyTag = await ContactTag.findAll({
  where: { tagId: { [Op.in]: allowedTagIds } },
  attributes: [[literal('DISTINCT "contactId"'), 'contactId']],
  raw: true
});
```

**Status:** ✅ Corrigido

---

### 2. SimpleListService.ts

**Arquivo:** `backend/src/services/ContactServices/SimpleListService.ts`

**Análise:** Já usa `GetUserWalletContactIds` que implementa a lógica correta (PELO MENOS UMA tag).

**Status:** ✅ Correto (sem alteração necessária)

---

### 3. ListTicketsService.ts

**Arquivo:** `backend/src/services/TicketServices/ListTicketsService.ts`

**Análise:** Já usa `GetUserWalletContactIds` que implementa a lógica correta (PELO MENOS UMA tag).

**Status:** ✅ Correto (sem alteração necessária)

---

### 4. ListTicketsServiceKanban.ts

**Arquivo:** `backend/src/services/TicketServices/ListTicketsServiceKanban.ts`

**Análise:** Já usa `GetUserWalletContactIds` que implementa a lógica correta (PELO MENOS UMA tag).

**Status:** ✅ Correto (sem alteração necessária)

---

### 5. GetUserWalletContactIds.ts

**Arquivo:** `backend/src/helpers/GetUserWalletContactIds.ts` (linhas 151-156)

**Código:**
```typescript
// Busca contatos que têm pelo menos uma tag pessoal permitida
const contactsWithTag = await ContactTag.findAll({
  where: { tagId: { [Op.in]: allPersonalTagIds } },
  attributes: [[literal('DISTINCT "contactId"'), 'contactId']],
  raw: true
});
```

**Status:** ✅ Correto (já implementava PELO MENOS UMA tag)

---

### 6. CheckContactOpenTickets.ts

**Arquivo:** `backend/src/helpers/CheckContactOpenTickets.ts` (linhas 97-99)

**Código:**
```typescript
const hasAnyTag = userAllowedTags.some(tagId => 
  contactTagIds.includes(tagId) || contactWalletIds.includes(tagId)
);
```

**Status:** ✅ Correto (já implementava PELO MENOS UMA tag)

---

## 📊 Resumo de Alterações

| Arquivo | Alteração | Status |
|---------|-----------|--------|
| ListContactsService.ts | Alterado de TODAS para PELO MENOS UMA | ✅ Corrigido |
| SimpleListService.ts | Sem alteração (já correto) | ✅ OK |
| ListTicketsService.ts | Sem alteração (já correto) | ✅ OK |
| ListTicketsServiceKanban.ts | Sem alteração (já correto) | ✅ OK |
| GetUserWalletContactIds.ts | Sem alteração (já correto) | ✅ OK |
| CheckContactOpenTickets.ts | Sem alteração (já correto) | ✅ OK |

---

## 🎯 Comportamento Unificado

### Regra Aplicada em Todo o Sistema

**PELO MENOS UMA tag:** Usuário vê contatos/tickets que tenham **qualquer uma** das suas tags.

### Exemplos

#### Exemplo 1: Contato Compartilhado
- **Contato:** `#ALLAN-ROSA` + `#BRUNA-ZANOBIO`
- **Allan (tem `#ALLAN-ROSA`):** ✅ Vê o contato
- **Bruna (tem `#BRUNA-ZANOBIO`):** ✅ Vê o contato

#### Exemplo 2: Contato Exclusivo
- **Contato:** `#ALLAN-ROSA`
- **Allan (tem `#ALLAN-ROSA`):** ✅ Vê o contato
- **Bruna (tem `#BRUNA-ZANOBIO`):** ❌ Não vê o contato

#### Exemplo 3: Usuário com Múltiplas Tags
- **Usuário:** `#ALLAN-ROSA` + `#BRUNA-ZANOBIO`
- **Contato A:** `#ALLAN-ROSA` → ✅ Vê
- **Contato B:** `#BRUNA-ZANOBIO` → ✅ Vê
- **Contato C:** `#ALLAN-ROSA` + `#BRUNA-ZANOBIO` → ✅ Vê
- **Contato D:** `#OUTRO` → ❌ Não vê

---

## 🔍 Verificação de Variáveis de Ambiente

### Script Criado

**Arquivo:** `backend/scripts/check-env-vars.js`

**Uso:**
```bash
cd backend
node scripts/check-env-vars.js
```

**Funcionalidade:**
- Verifica `BACKEND_URL`, `FRONTEND_URL`, `PORT`, `PROXY_PORT`
- Detecta se URLs apontam para localhost em produção
- Mostra exemplo de URL gerada para avatares
- Retorna código de erro se houver problemas

---

## 🚀 Deploy

### 1. Backend

```bash
cd backend
npm run build
pm2 restart whaticket-backend
```

### 2. Verificar Variáveis de Ambiente

```bash
cd backend
node scripts/check-env-vars.js
```

**Esperado em produção:**
```
✅ NODE_ENV: production
✅ BACKEND_URL: https://chatsapi.nobreluminarias.com.br
✅ FRONTEND_URL: https://chatsapi.nobreluminarias.com.br
✅ PORT: 8080
```

**Se aparecer localhost em produção:**
```
⚠️  BACKEND_URL aponta para localhost em produção!
   Deveria ser: https://chatsapi.nobreluminarias.com.br
```

---

## 🧪 Testes Recomendados

### Teste 1: Visualizar Contatos
1. **Login como Allan (tem `#ALLAN-ROSA`)**
   - Deve ver contatos com `#ALLAN-ROSA`
   - Deve ver contatos com `#ALLAN-ROSA` + outras tags
   - NÃO deve ver contatos apenas com `#BRUNA-ZANOBIO`

2. **Login como Bruna (tem `#BRUNA-ZANOBIO`)**
   - Deve ver contatos com `#BRUNA-ZANOBIO`
   - Deve ver contatos com `#BRUNA-ZANOBIO` + outras tags
   - NÃO deve ver contatos apenas com `#ALLAN-ROSA`

### Teste 2: Criar Ticket
1. **Contato tem `#ALLAN-ROSA` + ticket aberto**
   - Allan tenta criar ticket → Modal aparece (pode assumir)
   - Bruna tenta criar ticket → Erro genérico (sem permissão)

### Teste 3: Visualizar Tickets
1. **Tickets de contatos com `#ALLAN-ROSA`**
   - Allan deve ver na lista de tickets
   - Bruna NÃO deve ver

### Teste 4: Kanban
1. **Tickets de contatos com `#ALLAN-ROSA`**
   - Allan deve ver no Kanban
   - Bruna NÃO deve ver

---

## 📝 Problema de URLs Duplicadas nos Avatares

### Status Atual
- Script SQL não encontrou URLs duplicadas no banco
- Problema está no código ou variáveis de ambiente
- Getter `urlPicture` no modelo Contact está correto e protegido

### Próximos Passos
1. Executar `node scripts/check-env-vars.js` em produção
2. Verificar se `BACKEND_URL` e `FRONTEND_URL` estão corretos
3. Se estiverem incorretos, corrigir `.env` e reiniciar backend
4. Monitorar console do navegador para identificar duplicações

### Possível Causa
Se `BACKEND_URL` estiver como `http://localhost:8080` em produção, o getter vai gerar URLs como:
```
http://localhost:8080/public/company1/contacts/uuid/avatar.jpg
```

Mas o frontend pode estar tentando concatenar novamente, resultando em:
```
https://chatsapi.nobreluminarias.com.br/http://localhost:8080/public/company1/contacts/uuid/avatar.jpg
```

---

## 🔒 Segurança e Dados

✅ **Nenhuma funcionalidade perdida**  
✅ **Nenhum dado perdido**  
✅ **Comportamento unificado** (PELO MENOS UMA tag em todos os lugares)  
✅ **Lógica consistente** entre visualização de contatos, tickets e criação de tickets

---

## 📊 Impacto da Mudança

### Antes (TODAS as tags)
- Usuário com `#ALLAN-ROSA` + `#REPRESENTANTES` só via contatos com **ambas** as tags
- Segregação muito restritiva
- Contatos compartilhados eram invisíveis

### Depois (PELO MENOS UMA tag)
- Usuário com `#ALLAN-ROSA` + `#REPRESENTANTES` vê contatos com **qualquer uma** das tags
- Segregação flexível
- Contatos podem ser compartilhados entre usuários

**Conclusão:** Mudança alinha o sistema com o comportamento esperado pelo usuário.

---

**Status:** ✅ Pronto para produção (N1)  
**Risco:** Baixo  
**Impacto:** Alto (melhoria na UX e consistência do sistema)
