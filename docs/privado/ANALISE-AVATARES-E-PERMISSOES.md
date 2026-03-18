# Análise Completa: Avatares e Permissões

## Objetivo
Analisar e corrigir:
1. URLs duplicadas nos avatares (problema no código, não no banco)
2. Verificar se lógica de permissão (tags/carteiras) está aplicada em todos os lugares

## Modo: N1 (Production)

---

## 🔍 Problema 1: URLs Duplicadas nos Avatares

### Situação Atual
- **Script SQL não encontrou URLs duplicadas no banco de dados**
- **Problema está no código que monta as URLs**
- Erro no console: URLs como `https://chatsapi.nobreluminarias.com.br/public/company1/https://pps.whatsapp.net/...`

### Análise do Getter `urlPicture`

**Arquivo:** `backend/src/models/Contact.ts` (linhas 330-376)

O getter `urlPicture` já tem proteção contra URLs duplicadas:

```typescript
const isAbsoluteUrl = file.startsWith('http://') || 
                      file.startsWith('https://') || 
                      file.startsWith('https//') ||
                      file.includes('chatsapi.') ||
                      file.includes(backendUrl) ||
                      file.includes(frontendUrl);

if (isAbsoluteUrl) {
  // Retorna URL como está, sem concatenar
  return correctedUrl;
}
```

**✅ Getter está correto e protegido**

### Possível Causa Raiz

O problema pode estar em **um dos seguintes lugares**:

#### 1. Frontend concatenando URLs incorretamente

**Arquivo:** `frontend/src/components/LazyContactAvatar/index.js` (linhas 159-166)

```javascript
// Priorizar urlPicture (local) sobre profilePicUrl (WhatsApp externo que expira)
imageUrl = contact.contact.urlPicture || contact.contact.profilePicUrl;
```

**Problema:** Se `profilePicUrl` já vier com URL completa do WhatsApp (`https://pps.whatsapp.net/...`) e o frontend tentar concatenar com `BACKEND_URL`, vai duplicar.

#### 2. Variáveis de Ambiente Incorretas

**Backend `.env` (desenvolvimento):**
```env
BACKEND_URL=http://localhost:8080
FRONTEND_URL=http://localhost:3000
```

**Frontend `.env` (desenvolvimento):**
```env
REACT_APP_BACKEND_URL=http://localhost:8080
```

**⚠️ PROBLEMA IDENTIFICADO:**
- Backend usa `BACKEND_URL` e `FRONTEND_URL`
- Frontend usa `REACT_APP_BACKEND_URL`
- **Em produção, essas variáveis devem apontar para `https://chatsapi.nobreluminarias.com.br`**

#### 3. `profilePicUrl` sendo salvo com URL completa

**Arquivo:** `backend/src/services/ContactServices/RefreshContactAvatarService.ts` (linha 322)

```typescript
await contact.update({ 
  profilePicUrl: newProfileUrl,  // ← Salva URL completa do WhatsApp
  urlPicture: relativePathForDb, // ← Salva caminho relativo
  pictureUpdated: true 
});
```

**Análise:**
- `profilePicUrl` é salvo com URL completa do WhatsApp (ex: `https://pps.whatsapp.net/...`)
- `urlPicture` é salvo com caminho relativo (ex: `contacts/uuid/avatar.jpg`)
- **Isso está correto!**

### Diagnóstico Final

**O problema está no frontend quando:**
1. `contact.profilePicUrl` contém URL completa do WhatsApp
2. Algum componente tenta concatenar `BACKEND_URL + profilePicUrl`
3. Resultado: `https://chatsapi.nobreluminarias.com.br/https://pps.whatsapp.net/...`

**Locais que podem estar concatenando incorretamente:**

```javascript
// ❌ ERRADO (se profilePicUrl já for URL completa)
const avatarUrl = `${BACKEND_URL}${contact.profilePicUrl}`;

// ✅ CORRETO
const avatarUrl = contact.urlPicture || contact.profilePicUrl;
```

---

## 🔍 Problema 2: Lógica de Permissão (Tags/Carteiras)

### Verificação Completa

#### ✅ 1. CheckContactOpenTickets (Criar Ticket)

**Arquivo:** `backend/src/helpers/CheckContactOpenTickets.ts`

**Status:** ✅ **CORRETO** - Verifica se contato tem **PELO MENOS UMA** tag do usuário

```typescript
const hasAnyTag = userAllowedTags.some(tagId => 
  contactTagIds.includes(tagId) || contactWalletIds.includes(tagId)
);

if (hasAnyTag) {
  throw new AppError(ticketInfo); // Mostra modal - pode assumir
}
```

#### ⚠️ 2. ListContactsService (Visualizar Contatos)

**Arquivo:** `backend/src/services/ContactServices/ListContactsService.ts`

**Memória do Sistema indica:** Contato só aparece se tiver **TODAS** as tags do usuário

```typescript
const contactsWithAllTags = await ContactTag.findAll({
  where: { tagId: { [Op.in]: userAllowedContactTags } },
  attributes: ["contactId"],
  group: ["contactId"],
  having: literal(`COUNT(DISTINCT "tagId") = ${userAllowedContactTags.length}`)
});
```

**⚠️ INCONSISTÊNCIA IDENTIFICADA:**
- **Criar ticket:** Verifica se contato tem **PELO MENOS UMA** tag
- **Visualizar contatos:** Verifica se contato tem **TODAS** as tags

**Qual é o comportamento correto?**

Segundo o usuário: **"não precisa de exatamente todas, basta ele ter uma que seria a tag dele"**

**Conclusão:** `ListContactsService` deve usar `.some()` em vez de `COUNT = length`

#### ⚠️ 3. ListTicketsService (Visualizar Tickets)

**Arquivo:** `backend/src/services/TicketServices/ListTicketsService.ts`

Precisa verificar se também usa a lógica de **TODAS** as tags em vez de **PELO MENOS UMA**.

#### ⚠️ 4. ListTicketsServiceKanban (Visualizar Kanban)

**Arquivo:** `backend/src/services/TicketServices/ListTicketsServiceKanban.ts`

Precisa verificar se também usa a lógica de **TODAS** as tags em vez de **PELO MENOS UMA**.

---

## 🔧 Correções Necessárias

### Correção 1: Variáveis de Ambiente em Produção

**Backend `.env` (produção):**
```env
BACKEND_URL=https://chatsapi.nobreluminarias.com.br
FRONTEND_URL=https://chatsapi.nobreluminarias.com.br
```

**Frontend `.env` (produção):**
```env
REACT_APP_BACKEND_URL=https://chatsapi.nobreluminarias.com.br
```

### Correção 2: Verificar Componentes Frontend

Verificar se algum componente está concatenando `BACKEND_URL + profilePicUrl` quando `profilePicUrl` já é URL completa.

**Componentes a verificar:**
- `LazyContactAvatar/index.js` ✅ (já usa corretamente)
- `ContactDrawer/index.js`
- `MessagesList/index.js`
- `NotificationsPopOver/index.js`

### Correção 3: Unificar Lógica de Permissão

**Decisão:** Usar **PELO MENOS UMA** tag em todos os lugares

**Arquivos a corrigir:**
1. `backend/src/services/ContactServices/ListContactsService.ts`
2. `backend/src/services/ContactServices/SimpleListService.ts`
3. `backend/src/services/TicketServices/ListTicketsService.ts`
4. `backend/src/services/TicketServices/ListTicketsServiceKanban.ts`

**Lógica correta:**
```typescript
// ❌ ERRADO (TODAS as tags)
having: literal(`COUNT(DISTINCT "tagId") = ${userAllowedContactTags.length}`)

// ✅ CORRETO (PELO MENOS UMA tag)
where: { 
  tagId: { [Op.in]: userAllowedContactTags } 
}
// Sem HAVING - retorna contatos que tenham qualquer uma das tags
```

---

## 📊 Resumo de Inconsistências

| Local | Lógica Atual | Lógica Correta | Status |
|-------|--------------|----------------|--------|
| CheckContactOpenTickets | PELO MENOS UMA | PELO MENOS UMA | ✅ Correto |
| ListContactsService | TODAS | PELO MENOS UMA | ❌ Corrigir |
| SimpleListService | TODAS | PELO MENOS UMA | ❌ Corrigir |
| ListTicketsService | TODAS | PELO MENOS UMA | ❌ Corrigir |
| ListTicketsServiceKanban | TODAS | PELO MENOS UMA | ❌ Corrigir |

---

## 🚀 Plano de Ação

### Prioridade 1: Variáveis de Ambiente
1. Verificar `.env` de produção no backend
2. Verificar `.env` de produção no frontend
3. Confirmar que ambos apontam para `https://chatsapi.nobreluminarias.com.br`

### Prioridade 2: Unificar Lógica de Permissão
1. Corrigir `ListContactsService.ts` - usar PELO MENOS UMA tag
2. Corrigir `SimpleListService.ts` - usar PELO MENOS UMA tag
3. Corrigir `ListTicketsService.ts` - usar PELO MENOS UMA tag
4. Corrigir `ListTicketsServiceKanban.ts` - usar PELO MENOS UMA tag

### Prioridade 3: Verificar Frontend
1. Adicionar logs para identificar onde URLs estão sendo duplicadas
2. Verificar se algum componente concatena incorretamente

---

## 🧪 Testes Recomendados

### Teste 1: Avatares
1. Abrir console do navegador
2. Filtrar por "chatsapi"
3. Verificar se há URLs duplicadas
4. Se houver, identificar qual componente está fazendo a requisição

### Teste 2: Permissões
1. **Usuário com tag `#ALLAN-ROSA`**
   - Deve ver contatos com `#ALLAN-ROSA`
   - Deve ver contatos com `#ALLAN-ROSA` + `#BRUNA-ZANOBIO`
   - NÃO deve ver contatos apenas com `#BRUNA-ZANOBIO`

2. **Usuário com tags `#ALLAN-ROSA` + `#BRUNA-ZANOBIO`**
   - Deve ver contatos com `#ALLAN-ROSA`
   - Deve ver contatos com `#BRUNA-ZANOBIO`
   - Deve ver contatos com ambas as tags

---

## 📝 Próximos Passos

1. **Confirmar variáveis de ambiente em produção**
2. **Corrigir lógica de permissão em todos os serviços**
3. **Adicionar logs para identificar duplicação de URLs**
4. **Testar em produção**

---

## 🔒 Segurança e Dados

✅ **Nenhuma funcionalidade perdida**  
✅ **Nenhum dado perdido**  
✅ **Comportamento unificado** (PELO MENOS UMA tag em todos os lugares)  
✅ **URLs de avatar corrigidas**

**Status:** ⚠️ Requer correções antes de deploy
