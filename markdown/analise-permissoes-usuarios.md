# Análise Completa: Sistema de Permissões de Usuários

> **Data:** 28/01/2026  
> **Objetivo:** Mapear o fluxo de permissões (user, admin, super admin) e identificar lógicas incorretas

---

## 📊 Visão Geral do Sistema de Permissões

O sistema utiliza uma **hierarquia de 3 níveis** baseada em dois campos principais:

| Campo     | Tipo    | Valores             | Descrição                |
| --------- | ------- | ------------------- | ------------------------ |
| `profile` | string  | `"user"`, `"admin"` | Perfil básico do usuário |
| `super`   | boolean | `true`, `false`     | Flag de Super Admin      |

---

## 🔷 Mapa de Hierarquia de Permissões

```mermaid
graph TD
    subgraph Hierarquia["Hierarquia de Permissões"]
        SUPER["🔴 SUPER ADMIN<br/>super: true"]
        ADMIN["🟠 ADMIN<br/>profile: 'admin'"]
        USER["🟢 USER<br/>profile: 'user'"]
    end
    
    SUPER --> |"herda tudo"| ADMIN
    ADMIN --> |"herda tudo"| USER
    
    subgraph PermSuper["Permissões Exclusivas Super Admin"]
        S1["companies.* - Gerenciar Empresas"]
        S2["announcements.* - Comunicados Globais"]
        S3["all-connections.view - Todas Conexões"]
        S4["Pode promover outros a Super"]
    end
    
    subgraph PermAdmin["Permissões Admin"]
        A1["users.* - CRUD de Usuários"]
        A2["queues.* - Gerenciar Filas"]
        A3["connections.* - Conexões WhatsApp"]
        A4["settings.* - Configurações"]
        A5["campaigns.* - Campanhas"]
        A6["flowbuilder.* - Flows"]
        A7["ai-settings.* - Config IA"]
    end
    
    subgraph PermUser["Permissões Básicas User"]
        U1["tickets.view - Ver Tickets"]
        U2["quick-messages.view - Ver Respostas"]
        U3["contacts.view - Ver Contatos"]
        U4["tags.view - Ver Tags"]
        U5["helps.view - Ver Ajuda"]
    end
    
    SUPER --> PermSuper
    ADMIN --> PermAdmin
    USER --> PermUser
```

---

## 🔶 Fluxo de Verificação de Permissões (Backend)

```mermaid
flowchart TD
    START([Request HTTP]) --> ISAUTH{isAuth Middleware}
    ISAUTH --> |Token Válido| CHECKPERM
    ISAUTH --> |Token Inválido| DENY1[❌ 401 Unauthorized]
    
    CHECKPERM{Qual Middleware?}
    CHECKPERM --> |isSuper| SUPER_CHECK
    CHECKPERM --> |checkAdminOrSuper| ADMIN_SUPER_CHECK
    CHECKPERM --> |checkPermission| PERM_CHECK
    CHECKPERM --> |Nenhum| CONTROLLER
    
    SUPER_CHECK{user.super === true?}
    SUPER_CHECK --> |Sim| CONTROLLER[Controller Executa]
    SUPER_CHECK --> |Não| DENY2[❌ 401 Não Permitido]
    
    ADMIN_SUPER_CHECK{user.super === true<br/>OR profile === 'admin'?}
    ADMIN_SUPER_CHECK --> |Sim| CONTROLLER
    ADMIN_SUPER_CHECK --> |Não| DENY3[❌ 403 No Permission]
    
    PERM_CHECK{hasPermission<br/>PermissionAdapter}
    PERM_CHECK --> |Tem Permissão| CONTROLLER
    PERM_CHECK --> |Não Tem| DENY4[❌ 403 No Permission]
    
    CONTROLLER --> DBCHECK{Validação<br/>no Controller?}
    DBCHECK --> |Sim| VALIDATE
    DBCHECK --> |Não| EXECUTE
    
    VALIDATE{profile === 'admin'?}
    VALIDATE --> |Sim| EXECUTE[✅ Operação Executada]
    VALIDATE --> |Não| DENY5[❌ 403 No Permission]
    
    style DENY1 fill:#ff6b6b
    style DENY2 fill:#ff6b6b
    style DENY3 fill:#ff6b6b
    style DENY4 fill:#ff6b6b
    style DENY5 fill:#ff6b6b
    style EXECUTE fill:#51cf66
```

---

## ⚠️ Problemas Identificados

### 🔴 Problema 1: Inconsistência Frontend vs Backend

```mermaid
graph LR
    subgraph Frontend["Frontend - MainListItems.js"]
        F1["user.profile === 'super'"]
        F2["Verifica profile como string"]
    end
    
    subgraph Backend["Backend - User.ts Model"]
        B1["user.super === true"]
        B2["super é BOOLEAN, não string"]
    end
    
    F1 --> |"❌ INCORRETO"| PROBLEM["profile NUNCA é 'super'<br/>O valor correto é user.super (boolean)"]
    B1 --> |"✅ CORRETO"| OK["super é campo separado"]
    
    style PROBLEM fill:#ff6b6b
    style OK fill:#51cf66
```

**Localização do Problema:**
- [MainListItems.js:455](file:///c:/Users/feliperosa/whaticket/frontend/src/layout/MainListItems.js#L455): `user.profile === "admin" || user.profile === "super"`
- [MainListItems.js:465](file:///c:/Users/feliperosa/whaticket/frontend/src/layout/MainListItems.js#L465): mesma lógica incorreta
- [MainListItems.js:764](file:///c:/Users/feliperosa/whaticket/frontend/src/layout/MainListItems.js#L764): mesma lógica incorreta

**Impacto:** Menus que deveriam aparecer apenas para super admin **nunca aparecem** porque `profile` nunca é `"super"`.

---

### 🔴 Problema 2: Rotas sem Proteção Adequada

```mermaid
flowchart TD
    subgraph Rotas_Usuarios["Rotas de Usuários - userRoutes.ts"]
        R1["POST /users"] --> |"isAuth APENAS"| P1["⚠️ Valida no Controller"]
        R2["PUT /users/:userId"] --> |"isAuth APENAS"| P2["⚠️ Valida no Controller"]
        R3["DELETE /users/:userId"] --> |"isAuth APENAS"| P3["⚠️ Valida no Controller"]
        R4["GET /users"] --> |"isAuth APENAS"| P4["⚠️ SEM validação"]
    end
    
    subgraph Problema["O que deveria ter"]
        CORRETO["checkAdminOrSuper() ou checkPermission('users.*')"]
    end
    
    R1 -.-> |"Falta middleware"| CORRETO
    R2 -.-> |"Falta middleware"| CORRETO
    R3 -.-> |"Falta middleware"| CORRETO
    
    style P1 fill:#ffd43b
    style P2 fill:#ffd43b
    style P3 fill:#ffd43b
    style P4 fill:#ff6b6b
```

**Problema:** As rotas de usuários dependem de validação **dentro do controller** ao invés de usar middlewares. Isso é:
1. Menos seguro (se alguém esquecer a validação no controller)
2. Inconsistente com outras rotas que usam middlewares

---

### 🔴 Problema 3: Middlewares Duplicados/Conflitantes

```mermaid
graph TD
    subgraph Middlewares["Middlewares de Permissão"]
        M1["isSuper.ts<br/>(legado)"]
        M2["checkAdminOrSuper()<br/>(checkPermission.ts)"]
        M3["checkPermission()<br/>(checkPermission.ts)"]
    end
    
    M1 --> |"Faz a MESMA coisa"| M2
    
    subgraph Diferenças["Diferenças"]
        D1["isSuper: retorna 401"]
        D2["checkAdminOrSuper: retorna 403"]
    end
    
    M1 --> D1
    M2 --> D2
    
    CONFUSION["⚠️ CONFUSÃO: Qual usar?<br/>Códigos de erro diferentes!"]
    
    D1 --> CONFUSION
    D2 --> CONFUSION
    
    style CONFUSION fill:#ff6b6b
```

**Localização:**
- [isSuper.ts](file:///c:/Users/feliperosa/whaticket/backend/src/middleware/isSuper.ts)
- [checkPermission.ts](file:///c:/Users/feliperosa/whaticket/backend/src/middleware/checkPermission.ts)

---

### 🔴 Problema 4: Lógica de Criação de Usuário com Valor Default Incorreto

```mermaid
flowchart TD
    subgraph Criacao["CreateUserService.ts"]
        A["profile = 'admin'<br/>DEFAULT VALUE"] --> |"Novo usuário sem profile"| B["Usuário criado como ADMIN!"]
    end
    
    PROBLEMA["⚠️ PROBLEMA: Deveria ser 'user'<br/>Novo usuário recebe poder de admin por padrão"]
    
    B --> PROBLEMA
    
    style PROBLEMA fill:#ff6b6b
```

**Localização:** [CreateUserService.ts:52](file:///c:/Users/feliperosa/whaticket/backend/src/services/UserServices/CreateUserService.ts#L52)

```typescript
profile = "admin", // ❌ Deveria ser "user"
```

---

### 🔴 Problema 5: Validação Inconsistente de Super Admin

```mermaid
flowchart TD
    subgraph Controller["UserController - update"]
        A["Recebe super na request"]
        B{req.user.super?}
        B --> |Sim| C["Pode setar super"]
        B --> |Não| D["Erro 403"]
    end
    
    subgraph Problema["Mas..."]
        E["Na rota: isAuth APENAS"]
        F["Qualquer usuário logado<br/>pode TENTAR atualizar"]
        G["Validação só no controller"]
    end
    
    E --> F --> G
    
    RISK["⚠️ RISCO: Depende de lembrar<br/>de validar em cada controller"]
    G --> RISK
    
    style RISK fill:#ff6b6b
```

---

## 📋 Fluxo Completo de Autenticação e Autorização

```mermaid
sequenceDiagram
    participant U as Usuário
    participant F as Frontend
    participant B as Backend
    participant M as Middlewares
    participant C as Controller
    participant DB as Database
    
    U->>F: Login (email/senha)
    F->>B: POST /auth/login
    B->>DB: Busca usuário
    DB-->>B: User {profile, super, permissions}
    B->>B: Gera JWT token
    B-->>F: {token, user}
    F->>F: Salva token + user no contexto
    
    Note over F: usePermissions hook verifica:<br/>1. user.super === true?<br/>2. user.profile === "admin"?<br/>3. user.permissions.includes()?
    
    U->>F: Acessa /users
    F->>F: hasPermission("users.view")?
    
    alt Tem permissão
        F->>B: GET /users (com token)
        B->>M: isAuth - valida token
        M->>C: UserController.index
        C->>C: Valida profile === "admin"
        
        alt É admin
            C->>DB: Lista usuários
            DB-->>C: users[]
            C-->>F: {users, count}
            F-->>U: Exibe lista
        else Não é admin
            C-->>F: 403 ERR_NO_PERMISSION
            F-->>U: Erro: Sem permissão
        end
    else Não tem permissão
        F-->>U: Menu/botão não aparece
    end
```

---

## 🎯 Mapa de Permissões por Funcionalidade

```mermaid
mindmap
    root((Sistema de Permissões))
        Super Admin
            Gerenciar Empresas
            Comunicados Globais
            Ver Todas Conexões
            Promover Super Admins
            TUDO do Admin
        Admin
            CRUD Usuários
            Gerenciar Filas
            Gerenciar Conexões
            Configurações
            Campanhas
            Flowbuilder
            IA Settings
            Dashboard/Relatórios
            TUDO do User
        User Comum
            Ver Tickets Próprios
            Respostas Rápidas
            Ver Contatos
            Ver Tags
            Ajuda
            Flags Opcionais
                allTicket
                allowGroup
                allHistoric
                showDashboard
                allowRealTime
                allowConnections
```

---

## ✅ Resumo das Correções Necessárias

| #   | Problema                        | Arquivo                | Correção                                    |
| --- | ------------------------------- | ---------------------- | ------------------------------------------- |
| 1   | `profile === "super"` incorreto | `MainListItems.js`     | Trocar para `user.super === true`           |
| 2   | Rotas sem middleware            | `userRoutes.ts`        | Adicionar `checkPermission("users.*")`      |
| 3   | Middlewares duplicados          | `isSuper.ts`           | Depreciar e usar apenas `checkAdminOrSuper` |
| 4   | Default profile "admin"         | `CreateUserService.ts` | Mudar para `"user"`                         |
| 5   | Validação só no controller      | Vários                 | Mover validações para middlewares           |

---

## 📁 Arquivos Analisados

- [User.ts](file:///c:/Users/feliperosa/whaticket/backend/src/models/User.ts) - Model de usuário
- [PermissionAdapter.ts](file:///c:/Users/feliperosa/whaticket/backend/src/helpers/PermissionAdapter.ts) - Sistema de permissões granulares
- [checkPermission.ts](file:///c:/Users/feliperosa/whaticket/backend/src/middleware/checkPermission.ts) - Middlewares de verificação
- [isSuper.ts](file:///c:/Users/feliperosa/whaticket/backend/src/middleware/isSuper.ts) - Middleware legado
- [UserController.ts](file:///c:/Users/feliperosa/whaticket/backend/src/controllers/UserController.ts) - Controller de usuários
- [userRoutes.ts](file:///c:/Users/feliperosa/whaticket/backend/src/routes/userRoutes.ts) - Rotas de usuários
- [CreateUserService.ts](file:///c:/Users/feliperosa/whaticket/backend/src/services/UserServices/CreateUserService.ts) - Serviço de criação
- [usePermissions.js](file:///c:/Users/feliperosa/whaticket/frontend/src/hooks/usePermissions.js) - Hook de permissões (frontend)
- [MainListItems.js](file:///c:/Users/feliperosa/whaticket/frontend/src/layout/MainListItems.js) - Menu lateral
