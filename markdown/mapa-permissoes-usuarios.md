# 📋 Mapa Completo de Permissões de Usuários - Whaticket

> **Data da Análise:** 2026-02-03  
> **Atualizado:** 2026-02-03 13:40  
> **Status:** ✅ Correções implementadas

---

## ✅ Correções Implementadas

### 1. Filtro de Conexões para Admins não-Super

**Problema:** Admins viam todas as conexões, ignorando `allowedConnectionIds`

**Solução:** Mudança da condição `profile !== "admin"` para `!user.super`

| Arquivo | Status |
|---------|--------|
| [WhatsAppController.ts](file:///c:/Users/feliperosa/whaticket/backend/src/controllers/WhatsAppController.ts) | ✅ Corrigido |
| [ListTicketsService.ts](file:///c:/Users/feliperosa/whaticket/backend/src/services/TicketServices/ListTicketsService.ts) | ✅ Corrigido |
| [ListTicketsServiceKanban.ts](file:///c:/Users/feliperosa/whaticket/backend/src/services/TicketServices/ListTicketsServiceKanban.ts) | ✅ Corrigido |

---

### 2. Ghost Mode - Removido da Lista de Usuários

**Problema:** Ghost Mode ocultava o usuário da lista (incorreto)

**Solução:** Removido filtro isPrivate dos serviços de listagem de usuários

| Arquivo | Status |
|---------|--------|
| [ListUsersService.ts](file:///c:/Users/feliperosa/whaticket/backend/src/services/UserServices/ListUsersService.ts) | ✅ Corrigido |
| [SimpleListService.ts](file:///c:/Users/feliperosa/whaticket/backend/src/services/UserServices/SimpleListService.ts) | ✅ Corrigido |

---

## 📊 Hierarquia de Permissões (Corrigida)

```mermaid
flowchart TB
    subgraph SUPER["🔴 Super Admin (super=true)"]
        S1["✅ Vê TODAS as conexões"]
        S2["✅ Vê TODOS os tickets"]
        S3["✅ Configura conexões para outros"]
        S4["✅ Pode usar Ghost Mode"]
    end
    
    subgraph ADMIN["🟠 Admin (profile='admin', super=false)"]
        A1["📋 Vê apenas conexões em allowedConnectionIds"]
        A2["📋 Tickets apenas das conexões liberadas"]
        A3["📋 managedUserIds para supervisão"]
        A4["✅ Pode usar Ghost Mode"]
    end
    
    subgraph USER["🟢 User (profile='user')"]
        U1["📋 Vê apenas conexões em allowedConnectionIds"]
        U2["📋 Tickets apenas das conexões liberadas"]
        U3["📋 Contatos via allowedContactTags"]
        U4["🚫 NÃO pode usar Ghost Mode"]
    end
    
    SUPER --> ADMIN --> USER
```

---

## 🔄 Novo Fluxo de Permissões

### Filtro de Conexões

```mermaid
flowchart LR
    A[Requisição] --> B{user.super?}
    B -->|true| C["Super: Vê TODAS conexões"]
    B -->|false| D{allowedConnectionIds vazio?}
    D -->|Sim| E["Vê TODAS conexões"]
    D -->|Não| F["Filtra por allowedConnectionIds"]
```

### Ghost Mode (Comportamento Correto)

| Local | Ghost Mode Aplica? | Resultado |
|-------|-------------------|-----------|
| Lista de Usuários | ❌ NÃO | Usuários Ghost aparecem normalmente |
| Lista de Tickets | ✅ SIM | Tickets de Ghost são ocultos |
| Kanban | ✅ SIM | Tickets de Ghost são ocultos |

---

## 📋 Campos de Permissões do Modelo User

### Perfil Base
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `profile` | string | `admin` ou `user` |
| `super` | boolean | Super Admin (acesso total) |
| `isPrivate` | boolean | Ghost Mode (oculta tickets) |

### Hierarquia/Supervisão
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `allowedConnectionIds` | number[] | Conexões WhatsApp permitidas |
| `allowedContactTags` | number[] | Tags de contato (carteira) |
| `managedUserIds` | number[] | Usuários supervisionados |
| `supervisorViewMode` | string | `include` ou `exclude` |

---

## ✅ Resumo das Correções

| # | Correção | Arquivos | Status |
|---|----------|----------|--------|
| 1 | Filtro de conexões para não-super | 3 arquivos | ✅ |
| 2 | Ghost Mode na lista de usuários | 2 arquivos | ✅ |
| 3 | Build do backend | - | ✅ |

**Build:** Exit code 0 ✅
