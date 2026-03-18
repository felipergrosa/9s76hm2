# Análise Minuciosa: Eliminar Wallet e Migrar Tudo para Tag #

## Objetivo
Analisar viabilidade técnica de eliminar completamente a tabela `ContactWallet` e migrar todas as funcionalidades para o sistema de Tags # (Tags Pessoais).

**Hipótese:** A Wallet é redundante com a Tag #, pois ambas definem quais contatos um usuário pode acessar.

---

## Modo: N0 (Estudo/Análise)

---

## 🔍 Mapeamento Completo de Usos da Wallet

### 1. SMART ROUTING (Funcionalidade CRÍTICA - SÓ EXISTE NA WALLET)

**Arquivo:** `backend/src/services/TicketServices/FindOrCreateTicketService.ts:512-536`

```typescript
if (DirectTicketsToWallets && contact?.id && !groupContact) {
  const wallets = await contact.getWallets();
  if (wallets && wallets[0]?.id) {
    const User = (await import("../../models/User")).default;
    const walletOwner = await User.findByPk(wallets[0].id);
    
    // REGRA DE OURO: Só atribui se estiver ONLINE
    if (walletOwner && walletOwner.online) {
      ticketData.status = (!isImported && !isNil(settings?.enableLGPD)
        && openAsLGPD) ?
        "lgpd" : "open";
      ticketData.userId = wallets[0].id;  // Atribui automaticamente
      logger.info(`[SmartRouting] Ticket assigned to ONLINE wallet owner: ${walletOwner.name} (${walletOwner.id})`);
    } else {
      // Se dono estiver Offline/Férias -> Mantém Pending para Supervisor/Admin ver
      ticketData.status = "pending";
      ticketData.userId = null;
      logger.info(`[SmartRouting] Wallet owner ${walletOwner?.name} is OFFLINE. Ticket kept PENDING for supervision.`);
    }
  }
}
```

**Impacto:** Esta funcionalidade é ÚNICA da Wallet. Não existe equivalente em Tags #.
- Quando um ticket é criado, o sistema verifica se o contato tem uma Wallet
- Se sim, atribui automaticamente ao dono da carteira **SE ele estiver online**
- Se o dono estiver offline, deixa o ticket como PENDING para supervisão

**Migrar para Tag #:** Complicado. Teria que:
1. Buscar a tag pessoal do contato
2. Descobrir qual usuário tem essa tag em `allowedContactTags`
3. Verificar se o usuário está online
4. Atribuir o ticket

**Problema:** Um contato pode ter múltiplas tags pessoais (ex: #BRUNA e #ALLAN). Qual usuário "ganha" o ticket?

---

### 2. CONFIGURAÇÃO DIRECT TICKETS TO WALLETS (Settings)

**Arquivo:** `backend/src/models/CompaniesSettings.ts`

```typescript
@Column
DirectTicketsToWallets: boolean;  // Habilita/desabilita Smart Routing
```

**Migration:** `20231122223411-add-DirectTicketsToWallets-to-CompaniesSettings.ts`

**Frontend:** `frontend/src/components/Settings/Options.js`
- Toggle para habilitar/desabilitar o recurso
- Traduções em es.js, pt.js, tr.js

**Impacto:** Configuração de negócio importante. Remover = perder funcionalidade de roteamento.

---

### 3. API ENDPOINTS DE WALLET

**Rota:** `backend/src/routes/contactRoutes.ts:71`
```typescript
contactRoutes.put("/contact-wallet/:contactId", isAuth, checkPermission("contacts.edit-wallets"), ContactController.updateContactWallet);
```

**Permissão específica:** `contacts.edit-wallets` - existe uma permissão dedicada só para editar wallets!

**Controller:** `ContactController.updateContactWallet` (importa `UpdateContactWalletsService`)

**Impacto:** Frontend usa esta rota para salvar wallets. Remover = quebrar frontend.

---

### 4. SERVIÇOS DE SINCRONIZAÇÃO WALLET ↔ TAG

**Arquivo:** `backend/src/services/ContactServices/SyncContactWalletsAndPersonalTagsService.ts` (206 linhas)

Este serviço faz **sincronização bidirecional** entre Wallet e Tag #:
- Quando muda a wallet do contato → aplica/remove tags pessoais
- Quando muda a tag pessoal do contato → atualiza wallets

**Usado por:**
- `UpdateContactWalletsService.ts`
- `CreateContactService.ts`
- `UpdateContactService.ts`

**Impacto:** Se eliminar Wallet, este serviço inteiro vira código morto.

---

### 5. BULK OPERATIONS COM WALLET

**Arquivo:** `frontend/src/components/BulkEditContactsModal/index.js`
```javascript
// Atualização em massa de wallets
wallets: selectedWallets,
```

**Arquivo:** `backend/src/services/TicketServices/BulkProcessTicketsService.ts`
- Usa wallet para processar tickets em masso

**Arquivo:** `backend/src/services/ContactServices/BulkUpdateContactsService.ts`
- Atualiza wallets em lote

**Arquivo:** `backend/src/controllers/ContactController.ts:36`
```typescript
contactRoutes.put("/contacts/batch-update", isAuth, checkPermission("contacts.bulk-edit"), ContactController.bulkUpdate);
```

**Impacto:** Perder funcionalidade de edição em masso de carteiras.

---

### 6. FRONTEND - COMPONENTES COM WALLET

#### ContactModal (18 ocorrências)
```javascript
// Campo de seleção de wallets no modal de contato
<Autocomplete
  multiple
  options={users}
  value={values.wallets || []}
  onChange={(e, newValue) => setFieldValue('wallets', newValue)}
  // ...
/>
```

#### ContactForm (11 ocorrências)
```javascript
// Formulário de contato com wallets
wallets: contact?.wallets || [],
```

#### Settings/Options.js (13 ocorrências)
```javascript
// Configuração DirectTicketsToWallets
const [DirectTicketsToWallets, setDirectTicketsToWallets] = useState(false);
// ...
await update({ column: "DirectTicketsToWallets", data: value });
```

#### FilterContactModal
```javascript
// Filtro de contatos por wallet
wallets: selectedWallets,
```

#### ContactDrawer
```javascript
// Exibição de wallets no drawer
wallets: contact.wallets,
```

**Impacto:** ~76 ocorrências no frontend. Todas precisariam ser refatoradas.

---

### 7. RELATÓRIOS E ESTATÍSTICAS

**Arquivo:** `backend/src/services/Statistics/ContactsReportService.ts:45`
```typescript
interface Request {
  // ...
  wallets?: number[] | string[];  // Filtro por wallet
  // ...
}
```

**Arquivo:** `backend/src/services/Statistics/TicketsQueuesService.ts`
```typescript
import GetUserWalletContactIds from "../../helpers/GetUserWalletContactIds";
// Usa para filtrar tickets por carteira do usuário
```

**Impacto:** Relatórios perderiam funcionalidade de filtro por carteira.

---

### 8. CREATE/UPDATE CONTACT SERVICES

**Arquivo:** `backend/src/services/ContactServices/CreateContactService.ts:15`
```typescript
// Criação de contato COM wallets
const contactWallets: Wallet[] = [];
if (wallets) {
  wallets.forEach((wallet: any) => {
    contactWallets.push({
      walletId: !wallet.id ? wallet : wallet.id,
      contactId: contact.id,
      companyId
    });
  });
  await ContactWallet.bulkCreate(contactWallets);
}
```

**Arquivo:** `backend/src/services/ContactServices/UpdateContactWalletsService.ts` (73 linhas)
- Serviço dedicado SÓ para atualizar wallets
- Chama `SyncContactWalletsAndPersonalTagsService` após atualizar

**Impacto:** Criação/atualização de contatos precisaria ser refatorada.

---

### 9. CHECK PERMISSIONS (CheckContactOpenTickets)

**Arquivo:** `backend/src/helpers/CheckContactOpenTickets.ts`
- Usa `GetUserWalletContactIds` para verificar se usuário pode assumir ticket
- Considera wallets para permissões

**Impacto:** Sistema de permissões ficaria mais simples (só tags), mas perderia granularidade.

---

### 10. BACKFILL E MIGRAÇÕES

**Arquivo:** `backend/src/services/ContactServices/BackfillWalletsAndPersonalTagsService.ts`
- Preenche dados retroativos de wallets/tags

**Arquivo:** `backend/src/controllers/ContactController.ts`
```typescript
contactRoutes.post("/contacts/backfill-wallets-tags", isAuth, checkPermission("settings.view"), ContactController.backfillWalletsAndPersonalTags);
```

**Migration:** `20260123030000-enable-wallet-routing.ts` (6 ocorrências de wallet)

**Impacto:** Código de migração histórica.

---

## 📊 RESUMO DE IMPACTO

### Funcionalidades que SÓ a Wallet tem (NÃO replicáveis em Tag #):

1. **Smart Routing com Online Status** - Atribuição automática baseada em status online do usuário
2. **Múltiplas wallets por contato com prioridade** - Contato pode ter vários donos de carteira
3. **Permissão dedicada** - `contacts.edit-wallets` permite dar a alguém permissão de editar carteiras sem editar tags

### Funcionalidades que seriam PERDIDAS:

1. Filtro de relatórios por wallet específica
2. Edição em masso de wallets
3. Configuração de roteamento automático (DirectTicketsToWallets)
4. Visualização rápida de "quem é o dono deste contato" no modal

### Código a ser refatorado:

| Área | Arquivos | Linhas estimadas |
|------|----------|------------------|
| Backend Services | 15+ | ~2000 linhas |
| Backend Controllers | 3+ | ~500 linhas |
| Backend Routes | 1 | ~10 rotas |
| Frontend Components | 12+ | ~3000 linhas |
| Frontend Hooks/Utils | 5+ | ~500 linhas |
| Migrations | 2 | - |
| **TOTAL** | **38+ arquivos** | **~6000 linhas** |

---

## ✅ VEREDICTO FINAL

### **NÃO RECOMENDADO** ❌

Embora Wallet e Tag # pareçam redundantes, elas servem a **propósitos diferentes**:

| Aspecto | Wallet | Tag # |
|---------|--------|-------|
| **Propósito principal** | Atribuição/routing de tickets | Permissão de visualização |
| **Smart Routing** | ✅ Sim (único) | ❌ Não |
| **Múltiplos donos** | ✅ Sim (com prioridade) | ⚠️ Complicado |
| **Verificação online** | ✅ Sim | ❌ Não |
| **Filtro de relatórios** | ✅ Sim | ❌ Não |
| **Edição em masso** | ✅ Sim | ❌ Não |

### Alternativas melhores:

1. **Manter ambos** como estão hoje (recomendado)
2. **Melhorar sincronização** Wallet ↔ Tag (já existe, mas pode melhorar)
3. **Criar campo virtual** `walletTagId` no User para sincronização automática (como analisamos antes)

### Se insistir em eliminar Wallet:

**Esforço:** 40-60 horas de trabalho
**Riscos:** 
- Perda de funcionalidade crítica de routing
- Bugs de regressão em permissões
- Frustração de usuários que perdem "agilidade" de atribuição automática

**Complexidade técnica:** Muito Alta
**ROI:** Negativo (perde-se mais do que se ganha)

---

## 💡 RECOMENDAÇÃO PRÁTICA

Em vez de eliminar a Wallet, **centralizar a configuração** para o usuário:

```
Configuração do Usuário:
├── Tag Pessoal: [#BRUNA-ZANOBIO]  ← Seleciona 1
├── Wallet Virtual: [Bruna]       ← Sincroniza automaticamente
└── Auto-sync: [✅]                ← Mantém Wallet = Tag
```

Isso dá o **melhor dos dois mundos**:
- Usuário configura 1 vez (tag)
- Sistema mantém Wallet sincronizada
- Smart Routing continua funcionando
- Permissões granularidades mantidas

---

**Status:** ✅ Análise minuciosa completa

**Conclusão:** Mantém Wallet + melhora sincronização com Tag #
