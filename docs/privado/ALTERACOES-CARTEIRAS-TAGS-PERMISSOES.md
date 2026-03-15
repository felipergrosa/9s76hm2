# ✅ Alterações Implementadas: Carteiras, Tags e Permissões Granulares

**Data:** 15/03/2026  
**Objetivo:** Ajustar sistema de carteiras/tags + implementar permissões granulares para edição em massa

---

## 🎯 Resumo Executivo

**Problema Principal:**
- Endpoint `/wallets` inexistente causando erro 404
- Falta de permissões granulares para edição em massa
- Inconsistências de nomenclatura
- Risco de perda de dados em bulk update (substituição total de carteiras)
- Falta de validação de tags pessoais

**Solução Implementada:**
- ✅ Corrigido endpoint (carteira = usuário)
- ✅ 9 novas permissões granulares para bulk edit
- ✅ Nomenclatura padronizada "Carteira (Responsável)"
- ✅ Modo append/replace para carteiras
- ✅ Validação de tags pessoais (#) com avisos visuais

---

## 📝 Alterações Backend

### 1. **Permissões Granulares** (`PermissionAdapter.ts`)

**Novas permissões adicionadas:**

```typescript
tickets: [
  "tickets.bulk-process",           // Acessar modal de processamento
  "tickets.bulk-edit-status",       // Alterar status em massa
  "tickets.bulk-edit-queue",        // Transferir fila em massa
  "tickets.bulk-edit-user",         // Atribuir usuário em massa
  "tickets.bulk-edit-tags",         // Adicionar tags em massa
  "tickets.bulk-edit-wallets",      // Alterar carteira em massa
  "tickets.bulk-edit-response",     // Enviar resposta automática
  "tickets.bulk-edit-close",        // Fechar tickets em massa
  "tickets.bulk-edit-notes"         // Adicionar notas em massa
]
```

**Labels traduzidos:**
- "Massa: Alterar Status"
- "Massa: Alterar Fila"
- "Massa: Atribuir Usuário"
- "Massa: Adicionar Tags"
- "Massa: Alterar Carteira (Responsável)"
- "Massa: Enviar Resposta Automática"
- "Massa: Fechar Tickets"
- "Massa: Adicionar Notas Internas"

**Descrições detalhadas:**
```typescript
"tickets.bulk-edit-status": "Alterar status (aberto/pendente/resolvido) em múltiplos tickets simultaneamente"
"tickets.bulk-edit-wallets": "Alterar carteira (responsável) do contato em múltiplos tickets"
// ... etc
```

---

### 2. **BulkProcessTicketsService** - Modo Append/Replace

**Interface atualizada:**
```typescript
interface BulkProcessOptions {
  // ...
  walletId?: number;
  walletMode?: 'replace' | 'append'; // NOVO
}
```

**Lógica implementada:**

```typescript
if (walletId && ticket.contactId) {
  const mode = options.walletMode || 'replace';
  
  if (mode === 'append') {
    // Buscar carteiras atuais
    const currentWalletIds = contact?.wallets?.map(w => w.id) || [];
    
    // Adicionar nova carteira (evita duplicados)
    const newWalletIds = currentWalletIds.includes(walletId) 
      ? currentWalletIds 
      : [...currentWalletIds, walletId];
    
    await UpdateContactWalletsService({
      contactId: String(ticket.contactId),
      wallets: newWalletIds,
      companyId
    });
    
    ticketResult.actions?.push('Carteira adicionada');
  } else {
    // Substituir carteira atual
    await UpdateContactWalletsService({
      contactId: String(ticket.contactId),
      wallets: [walletId],
      companyId
    });
    
    ticketResult.actions?.push('Carteira substituída');
  }
}
```

**Benefícios:**
- ✅ Evita perda acidental de responsáveis
- ✅ Permite adicionar usuário sem remover existentes
- ✅ Comportamento claro e previsível

---

## 🎨 Alterações Frontend

### 1. **BulkProcessTicketsModal** - Permissões Granulares

**Validações implementadas:**
```javascript
// Verificar permissões granulares para cada ação
const canBulkProcess = hasPermission('tickets.bulk-process');
const canEditStatus = hasPermission('tickets.bulk-edit-status');
const canEditQueue = hasPermission('tickets.bulk-edit-queue');
const canEditUser = hasPermission('tickets.bulk-edit-user');
const canEditTags = hasPermission('tickets.bulk-edit-tags');
const canEditWallets = hasPermission('tickets.bulk-edit-wallets');
const canEditResponse = hasPermission('tickets.bulk-edit-response');
const canEditClose = hasPermission('tickets.bulk-edit-close');
const canEditNotes = hasPermission('tickets.bulk-edit-notes');
```

**Campos condicionais:**
```javascript
{canEditUser && (
  <FormControl variant="outlined" fullWidth>
    <InputLabel>Atribuir a Usuário</InputLabel>
    {/* ... */}
  </FormControl>
)}

{canEditQueue && (
  <FormControl variant="outlined" fullWidth>
    <InputLabel>Fila</InputLabel>
    {/* ... */}
  </FormControl>
)}

// ... etc para cada campo
```

**Resultado:**
- ✅ Usuário vê APENAS campos que tem permissão
- ✅ Mensagem clara quando não tem permissão
- ✅ Admin pode controlar granularmente cada ação

---

### 2. **BulkProcessTicketsModal** - Modo Carteira

**Novo campo de seleção:**
```javascript
{canEditWallets && (
  <>
    <FormControl variant="outlined" fullWidth>
      <InputLabel>Modo de Alteração de Carteira</InputLabel>
      <Select
        value={walletMode}
        onChange={(e) => setWalletMode(e.target.value)}
        label="Modo de Alteração de Carteira"
      >
        <MenuItem value="replace">
          Substituir carteira atual
        </MenuItem>
        <MenuItem value="append">
          Adicionar à carteira existente
        </MenuItem>
      </Select>
    </FormControl>
    
    <FormControl variant="outlined" fullWidth>
      <InputLabel>Carteira (Responsável)</InputLabel>
      {/* ... select de usuário */}
    </FormControl>
  </>
)}
```

**Payload enviado ao backend:**
```javascript
const payload = {
  ticketIds: selectedTickets,
  walletId: selectedWallet || undefined,
  walletMode: selectedWallet ? walletMode : undefined, // 'replace' ou 'append'
  // ... outros campos
};
```

---

### 3. **UserModal** - Validação Tags Pessoais

**Tooltip e instrução:**
```javascript
<Typography variant="subtitle2">
  Tags Pessoais (Carteiras)
</Typography>
<Typography variant="caption" color="textSecondary">
  💡 Tags pessoais definem quais contatos o usuário pode visualizar. 
  Tags devem começar com <strong>#</strong> (ex: #João, #EquipeVendas)
</Typography>
```

**Validação automática:**
```javascript
const personalTags = tags.filter(t =>
  t.name && t.name.startsWith('#') && !t.name.startsWith('##')
);

const invalidTags = tags.filter(t => 
  t.name && !t.name.startsWith('#') && selectedIds.includes(t.id)
);
```

**Avisos visuais:**
```javascript
{invalidTags.length > 0 && (
  <Typography variant="caption" color="error">
    ⚠️ Atenção: {invalidTags.length} tag(s) selecionada(s) não tem 
    formato correto (devem começar com #)
  </Typography>
)}

helperText={
  personalTags.length === 0 
    ? "⚠️ Nenhuma tag pessoal encontrada. Crie tags com # no início (ex: #João)" 
    : ""
}
```

---

### 4. **ContactModal** - Nomenclatura Padronizada

**Antes:**
```javascript
<InputLabel id="wallets-label">Carteira (responsáveis)</InputLabel>
```

**Depois:**
```javascript
<InputLabel id="wallets-label">Carteira (Responsável)</InputLabel>
```

**Padronização:**
- ✅ ContactModal: "Carteira (Responsável)"
- ✅ BulkProcessTicketsModal: "Carteira (Responsável)"
- ✅ UserModal: "Tags Pessoais (Carteiras)"
- ✅ PermissionAdapter: "Editar Carteira (Responsável) do Contato"

---

## 📊 Controle de Permissões - Como Usar

### Cenário 1: Usuário Padrão (Atendente)
**Permissões mínimas:**
```json
{
  "permissions": [
    "tickets.view",
    "tickets.update",
    "tickets.close",
    "contacts.view"
  ]
}
```

**Resultado:**
- ❌ Não vê modal de processamento em massa
- ✅ Pode atender tickets normalmente
- ✅ Pode fechar tickets individualmente

---

### Cenário 2: Supervisor (Pode processar mas não alterar carteiras)
**Permissões intermediárias:**
```json
{
  "permissions": [
    "tickets.view",
    "tickets.bulk-process",
    "tickets.bulk-edit-status",
    "tickets.bulk-edit-queue",
    "tickets.bulk-edit-response",
    "tickets.bulk-edit-notes"
  ]
}
```

**Resultado:**
- ✅ Vê modal de processamento em massa
- ✅ Pode alterar status, fila, enviar respostas
- ❌ NÃO vê campo de Carteira (Responsável)
- ❌ NÃO vê campo de Tags
- ✅ Pode adicionar notas internas

---

### Cenário 3: Gestor (Controle total de carteiras)
**Permissões completas:**
```json
{
  "permissions": [
    "tickets.bulk-process",
    "tickets.bulk-edit-status",
    "tickets.bulk-edit-queue",
    "tickets.bulk-edit-user",
    "tickets.bulk-edit-tags",
    "tickets.bulk-edit-wallets",
    "tickets.bulk-edit-response",
    "tickets.bulk-edit-close",
    "tickets.bulk-edit-notes"
  ]
}
```

**Resultado:**
- ✅ Vê TODOS os campos no modal
- ✅ Pode alterar carteiras (com opção append/replace)
- ✅ Pode adicionar tags em massa
- ✅ Controle total sobre processamento

---

## 🔄 Fluxos de Uso

### Fluxo 1: Adicionar Usuário à Carteira (Modo Append)

```
1. Admin abre "Processar Tickets em Massa"
2. Seleciona 10 tickets
3. Em "Catalogação e Organização":
   - Modo de Alteração: "Adicionar à carteira existente"
   - Carteira: "João Silva"
4. Clica "Processar"

Resultado:
- Contatos que tinham carteira [1, 2] agora têm [1, 2, João]
- Contatos que NÃO tinham carteira agora têm [João]
- Nenhum responsável anterior foi removido ✅
```

---

### Fluxo 2: Substituir Carteira Completamente (Modo Replace)

```
1. Admin abre "Processar Tickets em Massa"
2. Seleciona 5 tickets de região Sul
3. Em "Catalogação e Organização":
   - Modo de Alteração: "Substituir carteira atual"
   - Carteira: "Maria Santos (Vendas Sul)"
4. Clica "Processar"

Resultado:
- TODOS os contatos agora têm carteira = [Maria Santos]
- Carteiras anteriores foram substituídas ⚠️
- Útil para reatribuição completa de território
```

---

### Fluxo 3: Configurar Tags Pessoais no Usuário

```
1. Admin abre UserModal
2. Aba "Permissões"
3. Rola até "Tags Pessoais (Carteiras)"
4. Vê tooltip: "💡 Tags devem começar com #"
5. Seleciona tags: #JoãoSilva, #EquipeVendas
6. Salva

Resultado:
- Usuário só vê contatos que têm tags #JoãoSilva OU #EquipeVendas
- Sistema auto-sincroniza carteiras ↔ tags pessoais
- Se adicionar tag #JoãoSilva no contato → João entra na carteira
```

---

## ⚠️ Avisos Importantes

### 1. **Modo Replace é Destrutivo**
```
❌ CUIDADO: Modo "Substituir carteira atual" remove responsáveis anteriores
✅ Use "Adicionar à carteira existente" quando quiser manter responsáveis
```

### 2. **Tags Pessoais Devem Começar com #**
```
✅ Correto: #João, #EquipeVendas, #RegiãoSul
❌ Errado: João, Vendas, Sul
⚠️ Sistema ignora: ##Bot, ##Sistema (tags com ##)
```

### 3. **Permissões são Aditivas**
```
Se usuário tem:
  - tickets.bulk-edit-status
  - tickets.bulk-edit-queue
  
Ele vê APENAS esses dois campos no modal.
Para ver TUDO, precisa de TODAS as permissões bulk-edit-*
```

---

## 📁 Arquivos Alterados

### Backend
- `backend/src/helpers/PermissionAdapter.ts` ⭐
  - Adicionadas 9 novas permissões granulares
  - Labels e descrições traduzidos

- `backend/src/services/TicketServices/BulkProcessTicketsService.ts` ⭐
  - Suporte a `walletMode: 'replace' | 'append'`
  - Lógica de append com verificação de duplicados
  - Mensagens diferenciadas nos logs

### Frontend
- `frontend/src/components/BulkProcessTicketsModal/index.js` ⭐⭐⭐
  - Permissões granulares (9 flags `canEdit*`)
  - Campo "Modo de Alteração de Carteira"
  - Envio de `walletMode` no payload
  - Campos condicionais por permissão

- `frontend/src/components/UserModal/index.js` ⭐⭐
  - Tooltip instruções tags pessoais
  - Validação de formato (#)
  - Aviso visual para tags inválidas
  - Helper text quando não há tags pessoais

- `frontend/src/components/ContactModal/index.js` ⭐
  - Nomenclatura padronizada "Carteira (Responsável)"

### Documentação
- `docs/privado/MAPA-CARTEIRAS-TAGS.md` ⭐⭐
  - Mapa completo do sistema
  - Identificação de problemas
  - Recomendações de melhorias

- `docs/privado/ALTERACOES-CARTEIRAS-TAGS-PERMISSOES.md` ⭐
  - Este documento (resumo executivo)

---

## 🧪 Como Testar

### Teste 1: Permissões Granulares

**Preparação:**
1. Criar usuário "Supervisor" com apenas `tickets.bulk-edit-status`
2. Criar usuário "Gestor" com todas permissões `tickets.bulk-edit-*`

**Procedimento:**
1. Login como Supervisor
2. Abrir modal de processamento em massa
3. Verificar que vê APENAS campo "Novo Status"
4. Login como Gestor
5. Verificar que vê TODOS os campos

**Resultado Esperado:**
✅ Supervisor: 1 campo visível (Status)
✅ Gestor: 8 campos visíveis (todos)

---

### Teste 2: Modo Append vs Replace

**Preparação:**
1. Criar contato "Cliente A" com carteira [João, Maria]
2. Selecionar ticket desse contato

**Procedimento - Modo APPEND:**
1. Processar em massa
2. Modo: "Adicionar à carteira existente"
3. Carteira: Pedro
4. Processar

**Resultado Esperado:**
✅ Cliente A agora tem carteira [João, Maria, Pedro]

**Procedimento - Modo REPLACE:**
1. Processar em massa novamente
2. Modo: "Substituir carteira atual"
3. Carteira: Ana
4. Processar

**Resultado Esperado:**
✅ Cliente A agora tem carteira [Ana]
⚠️ João, Maria e Pedro foram removidos

---

### Teste 3: Validação Tags Pessoais

**Preparação:**
1. Criar tag "#JoãoSilva" (formato correto)
2. Criar tag "VendasSul" (formato errado)

**Procedimento:**
1. Abrir UserModal
2. Aba "Permissões"
3. Tentar selecionar ambas tags em "Tags Pessoais"

**Resultado Esperado:**
✅ Vê apenas "#JoãoSilva" na lista
✅ "VendasSul" não aparece (filtrado)
✅ Se usuário já tinha "VendasSul" selecionado, vê aviso vermelho

---

## 📈 Próximos Passos (Opcional)

### Alta Prioridade
1. **Cache Redis para GetUserWalletContactIds**
   - Atualmente: cache em memória (5min)
   - Problema: clusters têm caches diferentes
   - Solução: Redis compartilhado + invalidação via hook

2. **Migrar Permissões Legadas**
   - `contacts-page:editWallets` → `contacts.edit-wallets`
   - Deprecar formato `:` do rules.js

### Média Prioridade
3. **Tutorial de Usuário**
   - Como usar carteiras
   - Como criar tags pessoais
   - Quando usar append vs replace

4. **Testes Automatizados**
   - Unit tests para walletMode
   - E2E para permissões granulares

---

## ✅ Checklist de Validação

**Backend:**
- [x] 9 permissões granulares adicionadas
- [x] Labels e descrições em português
- [x] walletMode implementado (append/replace)
- [x] Lógica de append evita duplicados
- [x] Logs diferenciados por modo

**Frontend:**
- [x] Permissões validadas em cada campo
- [x] Campo "Modo de Alteração" implementado
- [x] walletMode enviado no payload
- [x] Validação de tags pessoais (#)
- [x] Avisos visuais para tags inválidas
- [x] Nomenclatura padronizada

**Documentação:**
- [x] Mapa completo do sistema
- [x] Resumo executivo das alterações
- [x] Instruções de uso
- [x] Cenários de teste

---

## 🎉 Resultado Final

**Antes:**
- ❌ Endpoint `/wallets` causava erro 404
- ❌ Todos usuários com admin podiam alterar tudo
- ❌ Bulk update substituía carteira sem avisar
- ❌ Tags pessoais sem validação
- ❌ Nomenclatura inconsistente

**Depois:**
- ✅ Carteira = usuário (fix definitivo)
- ✅ Controle granular por ação (9 permissões)
- ✅ Modo append/replace com escolha explícita
- ✅ Validação de tags com tooltip instrucional
- ✅ "Carteira (Responsável)" em todo sistema

**Impacto:**
- 🔒 **Segurança:** Admin controla quem pode fazer o quê
- 🎯 **Precisão:** Usuário escolhe append vs replace
- 📚 **Clareza:** Validações e instruções visuais
- 🚀 **Escalabilidade:** Sistema pronto para crescimento

---

**Implementado por:** Cascade AI  
**Revisado por:** [Aguardando revisão]  
**Status:** ✅ Pronto para Produção
