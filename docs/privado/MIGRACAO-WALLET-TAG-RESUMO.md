# MIGRAÇÃO WALLET → TAG # (RESUMO)

## ✅ COMPLETADO - Backend

### 1. Migrations
- `20260318000000-enforce-single-personal-tag.ts` - Garante 1 tag pessoal por usuário
- `20260318000001-remove-contactwallet-table.ts` - Remove tabela ContactWallet

### 2. Modelos
- **User.ts** - Adicionado método `getPersonalTagId()`
- **Contact.ts** - Removida associação ContactWallet, adicionado `getWalletOwners()`
- **database/index.ts** - Removido ContactWallet

### 3. Smart Routing (NOVO)
- **FindOrCreateTicketService.ts** - Smart Routing por tags pessoais
  - Busca donos do contato via `contact.getWalletOwners()`
  - Primeiro online recebe o ticket
  - Nenhum online = ticket fica PENDING

### 4. Serviços Removidos
- ContactWallet.ts (modelo)
- UpdateContactWalletsService.ts
- SyncContactWalletsAndPersonalTagsService.ts
- BackfillWalletsAndPersonalTagsService.ts
- GetUserWalletContactIds.ts

### 5. Serviços Atualizados
- **CreateContactService.ts** - Removida toda lógica de wallets
- **ListContactsService.ts** - Filtro por tag pessoal em vez de wallet
- **SimpleListService.ts** - Filtro por tag pessoal em vez de wallet
- **ContactController.ts** - Removidos métodos:
  - `updateContactWallet`
  - `backfillWalletsAndPersonalTags`
- **contactRoutes.ts** - Removidas rotas:
  - `/contact-wallet/:contactId`
  - `/contacts/backfill-wallets-tags`

---

## ✅ COMPLETADO - Frontend

### 1. UserModal
- Tag pessoal obrigatória (validação Yup)
- Apenas 1 tag permitida (Autocomplete single)

### 2. ContactModal
- Mantida estrutura de wallets na UI
- wallets calculado dinamicamente das tags pessoais (#)
- Ao editar wallets, sincroniza tags pessoais automaticamente

---

## ⏳ PENDENTE

### 1. Demais componentes frontend
- BulkProcessTicketsModal - Adaptar campo wallets
- BulkEditContactsModal - Adaptar campo wallets  
- ContactForm - Adaptar campo wallets
- FilterContactModal - Adaptar filtro wallets
- Settings/Options.js - Remover DirectTicketsToWallets

### 2. Permissões
- Remover permissão `contacts.edit-wallets` das regras

---

## 🔧 COMANDOS PARA PRODUÇÃO

```bash
# 1. Backup do banco
pg_dump -h localhost -U whaticket whaticket > backup_pre_wallet_migration.sql

# 2. Executar migrations
npm run migrate

# 3. Verificar se tudo OK
npm run build
npm start
```

---

## 📝 LÓGICA DO NOVO SMART ROUTING

```typescript
if (DirectTicketsToWallets && contact?.id && !groupContact) {
  const walletOwners = await contact.getWalletOwners();

  if (walletOwners && walletOwners.length > 0) {
    const onlineOwner = walletOwners.find(u => u.online);

    if (onlineOwner) {
      ticketData.userId = onlineOwner.id;
      ticketData.status = "open";
    } else {
      ticketData.status = "pending";
      ticketData.userId = null;
    }
  }
}
```

**Comportamento:**
1. Contato com tag #BRUNA → Busca usuários com allowedContactTags=[tagId]
2. Se Bruna online → ticket vai para ela
3. Se Bruna offline + Allan online → vai para Allan (primeiro da lista online)
4. Nenhum online → ticket fica PENDING para quem aceitar primeiro

---

## 🔄 FLUXO DE DADOS - Campo Wallets (Frontend)

**Leitura:**
1. Contato tem tags → Identifica tags pessoais (#)
2. Busca usuários com essas tags em allowedContactTags
3. Exibe como "Carteira (Responsável)"

**Escrita:**
1. Usuário seleciona wallets → Pega tag pessoal de cada usuário
2. Adiciona essas tags ao contato
3. Backend salva tags → Smart Routing funciona

---

## ⚠️ ATENÇÃO

**Pré-requisito antes de executar migrations:**
- Garantir que cada usuário tenha 1 tag pessoal (migração cria automaticamente)
- Backup obrigatório - migração é irreversível

---

Status: Backend 90% | Frontend 40% concluído
