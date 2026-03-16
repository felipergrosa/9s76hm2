# Mapeamento de Permissões por Operação - Sistema de Tickets

## Objetivo
Este documento mapeia todas as permissões necessárias para cada operação na tela de tickets, garantindo que usuários comuns possam trabalhar sem receber erros 403 desnecessários.

---

## Permissões Base do Usuário Comum

**Definição:** Usuário comum (profile: "user") sem permissões customizadas recebe automaticamente:

```javascript
[
  "tickets.view",         // Ver lista de tickets
  "tickets.update",       // Enviar mensagens, aceitar, fechar tickets
  "tickets.create",       // Criar novos tickets
  "quick-messages.view",  // Ver respostas rápidas
  "contacts.view",        // Ver informações de contatos
  "tags.view",            // Ver tags
  "helps.view",           // Ver ajuda
  "announcements.view"    // Ver informativos
]
```

**Arquivo:** `backend/src/helpers/PermissionAdapter.ts` → `getBaseUserPermissions()`

---

## Operações na Tela de Tickets e Permissões Necessárias

### 1. **Visualizar Lista de Tickets**
**Endpoint:** `GET /tickets`  
**Permissão necessária:** `tickets.view`  
**Tratamento 403:** Silencioso (não exibe erro)  
**Arquivo frontend:** `frontend/src/hooks/useTickets/index.js`

---

### 2. **Aceitar Ticket (Pending → Open/Group)**
**Endpoint:** `PUT /tickets/:ticketId`  
**Permissão necessária:** `tickets.update`  
**Tratamento 403:** Silencioso  
**Arquivo frontend:** `frontend/src/components/TicketListItemCustom/index.js` → `handleAcepptTicket`

**Operações adicionais:**
- `GET /settings` (sendGreetingAccepted) → Permissão: `settings.view` (opcional, erro silenciado)
- `POST /messages/:ticketId` (enviar mensagem de boas-vindas) → Permissão: `tickets.update`

---

### 3. **Fechar Ticket**
**Endpoint:** `PUT /tickets/:ticketId` (status: "closed")  
**Permissão necessária:** `tickets.update`  
**Tratamento 403:** Silencioso  
**Arquivo frontend:** `frontend/src/components/TicketListItemCustom/index.js` → `handleCloseTicket`

**Operações adicionais:**
- `GET /contactTags/:contactId` (verificar tag obrigatória) → Permissão: `contacts.view` (erro silenciado)

---

### 4. **Enviar Mensagem**
**Endpoint:** `POST /messages/:ticketId`  
**Permissão necessária:** `tickets.update`  
**Tratamento 403:** Silencioso  
**Arquivo frontend:** `frontend/src/components/TicketListItemCustom/index.js` → `handleSendMessage`

**Operações adicionais:**
- `GET /settings` (greetingAcceptedMessage) → Permissão: `settings.view` (opcional, erro silenciado)

---

### 5. **Visualizar Mensagens do Ticket**
**Endpoint:** `GET /messages/:ticketId`  
**Permissão necessária:** `tickets.view`  
**Tratamento 403:** Exibe erro (operação crítica)

---

### 6. **Transferir Ticket**
**Endpoint:** `PUT /tickets/:ticketId` (userId, queueId)  
**Permissão necessária:** `tickets.transfer`  
**Tratamento 403:** Exibe erro

**Nota:** Usuário comum NÃO tem essa permissão por padrão. Necessita configuração manual.

---

### 7. **Deletar Ticket**
**Endpoint:** `DELETE /tickets/:ticketId`  
**Permissão necessária:** `tickets.delete`  
**Tratamento 403:** Exibe erro

**Nota:** Usuário comum NÃO tem essa permissão por padrão. Apenas admin.

---

## Operações com Settings (Configurações)

### Verificação de Configurações do Sistema
**Endpoints:**
- `GET /settings` (requiredTag, sendGreetingAccepted, greetingAcceptedMessage)

**Permissão necessária:** `settings.view`  
**Tratamento 403:** **SILENCIOSO** (configurações são opcionais para o funcionamento básico)

**Impacto:** Se usuário não tem permissão:
- Sistema funciona normalmente
- Configurações assumem valores padrão (disabled)
- Nenhum erro exibido ao usuário

---

## Operações com Contatos

### Verificar Tags do Contato
**Endpoint:** `GET /contactTags/:contactId`  
**Permissão necessária:** `contacts.view`  
**Tratamento 403:** **SILENCIOSO**

**Impacto:** Se usuário não tem permissão:
- Verificação de tag obrigatória é ignorada
- Ticket pode ser fechado normalmente
- Nenhum erro exibido

---

## Tabela Resumida de Permissões

| Operação | Endpoint | Permissão Necessária | Usuário Comum Tem? | Erro 403 Silenciado? |
|----------|----------|---------------------|-------------------|---------------------|
| Ver tickets | `GET /tickets` | `tickets.view` | ✅ Sim | ✅ Sim |
| Aceitar ticket | `PUT /tickets/:id` | `tickets.update` | ✅ Sim | ✅ Sim |
| Fechar ticket | `PUT /tickets/:id` | `tickets.update` | ✅ Sim | ✅ Sim |
| Enviar mensagem | `POST /messages/:id` | `tickets.update` | ✅ Sim | ✅ Sim |
| Ver mensagens | `GET /messages/:id` | `tickets.view` | ✅ Sim | ❌ Não |
| Transferir ticket | `PUT /tickets/:id` | `tickets.transfer` | ❌ Não | ❌ Não |
| Deletar ticket | `DELETE /tickets/:id` | `tickets.delete` | ❌ Não | ❌ Não |
| Ver configurações | `GET /settings` | `settings.view` | ❌ Não | ✅ Sim |
| Ver tags do contato | `GET /contactTags/:id` | `contacts.view` | ✅ Sim | ✅ Sim |

---

## Como Conceder Permissões Adicionais

### Via Interface (Recomendado)
1. Acesse **Configurações > Usuários**
2. Clique em **Editar** no usuário desejado
3. Vá para aba **Permissões**
4. Marque as permissões desejadas:
   - **Transferir Atendimentos** → `tickets.transfer`
   - **Fechar Atendimentos** → `tickets.close`
   - **Deletar Atendimentos** → `tickets.delete`
5. Clique em **Salvar**

### Permissões Granulares Disponíveis

**Atendimento:**
- `tickets.view` - Ver atendimentos
- `tickets.create` - Criar atendimentos
- `tickets.update` - Atualizar atendimentos (enviar mensagens, aceitar)
- `tickets.transfer` - Transferir atendimentos
- `tickets.close` - Fechar atendimentos
- `tickets.delete` - Deletar atendimentos
- `tickets.view-all` - Ver chamados sem fila
- `tickets.view-groups` - Permitir grupos
- `tickets.view-all-historic` - Ver histórico completo
- `tickets.view-all-users` - Ver conversas de outros usuários

---

## Tratamento de Erros 403 no Frontend

### Componentes com Tratamento Silencioso Implementado

1. **TicketListItemCustom** (`frontend/src/components/TicketListItemCustom/index.js`)
   - `handleCloseTicket()` - Linha 517-524, 533-540, 559-566
   - `handleAcepptTicket()` - Linha 619-624, 637-644
   - `handleSendMessage()` - Linha 655-660, 671-677

2. **useTickets Hook** (`frontend/src/hooks/useTickets/index.js`)
   - `fetchTickets()` - Linha 134-139

3. **UserModal** (`frontend/src/components/UserModal/index.js`)
   - `uploadAvatar()` - Linha 239-245

### Padrão de Tratamento

```javascript
try {
  await api.post('/endpoint', data);
} catch (err) {
  // 403 = sem permissão X (admin)
  // Silencia o erro
  if (err?.response?.status !== 403) {
    toastError(err);
  }
}
```

**Quando silenciar 403:**
- Operações opcionais (configurações, tags)
- Recursos que não impedem o funcionamento básico
- Verificações adicionais que têm fallback

**Quando NÃO silenciar 403:**
- Operações críticas (visualizar mensagens)
- Ações que o usuário iniciou explicitamente
- Quando não há alternativa de funcionamento

---

## Troubleshooting

### Erro: "Múltiplos erros 403 ao carregar tela de tickets"

**Causa:** Usuário sem permissões base configuradas corretamente.

**Solução:**
1. Verificar se usuário tem `tickets.view` e `tickets.update`
2. Se não tiver, adicionar via interface de permissões
3. Ou aguardar que sistema aplique permissões base automaticamente

### Erro: "403 ao enviar mensagem"

**Causa:** Usuário sem permissão `tickets.update`.

**Solução:**
1. Conceder permissão `tickets.update` ao usuário
2. Verificar se perfil é "user" (deveria ter por padrão)

### Erro: "403 ao aceitar ticket"

**Causa:** Mesma que acima - falta `tickets.update`.

**Solução:**
1. Conceder permissão `tickets.update`
2. Se perfil for "user", verificar sistema de permissões base

---

## Arquivos Modificados

### Backend
- `backend/src/helpers/PermissionAdapter.ts` - Permissões base do usuário comum
- `backend/src/routes/ticketRoutes.ts` - Rotas de tickets com checkPermission
- `backend/src/routes/messageRoutes.ts` - Rotas de mensagens com checkPermission
- `backend/src/routes/contactRoutes.ts` - Rotas de contatos com checkPermission

### Frontend
- `frontend/src/hooks/useTickets/index.js` - Tratamento 403 silencioso
- `frontend/src/components/TicketListItemCustom/index.js` - Tratamento 403 silencioso
- `frontend/src/components/UserModal/index.js` - Tratamento 403 em upload de avatar

---

## Changelog

**2026-03-16:**
- ✅ Adicionadas permissões base `tickets.update` e `tickets.create` para usuários comuns
- ✅ Implementado tratamento silencioso de 403 em operações opcionais
- ✅ Documentado mapeamento completo de permissões por operação
- ✅ Criado guia de troubleshooting para erros 403
