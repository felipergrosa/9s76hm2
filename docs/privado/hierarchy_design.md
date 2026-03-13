# Nova Hierarquia de Usuários e Controle de Acesso

Este documento detalha o plano para reformulação da hierarquia de usuários, introduzindo controle granular sobre Conexões (WhatsApp) e visibilidade de dados.

## 1. Visão Geral dos Papéis

### 👑 Super Admin (Dono/Gestor)
*   **Permissão:** Acesso total ao sistema.
*   **Conexões:**
    *   Vê e usa **TODAS** as conexões.
    *   Controla quais conexões são liberadas para outros.
*   **Privacidade ("Ghost Mode"):**
    *   **Ativado:** Seus tickets e sua conexão pessoal ficam **invisíveis** para Supervisores e Usuários.
    *   **Desativado:** Funciona como um Admin normal (visível).

### 👮 Supervisor (Gestor de Equipe)
*   **Permissão:** Baseada em Perfil "User" + Lista de Usuários Gerenciados.
*   **Visibilidade:**
    *   ✅ Vê seus próprios dados.
    *   ✅ Vê dados da sua **Equipe** (usuários que ele gerencia).
    *   ❌ **NÃO** vê dados do Super Admin (se Ghost Mode ativado).
*   **Conexões:**
    *   ✅ Vê/Usa apenas as conexões explicitamente **LIBERADAS** para ele.

### 👤 Usuário (Agente/Vendedor)
*   **Permissão:** Perfil "User" padrão.
*   **Visibilidade:**
    *   ✅ Restrita aos seus próprios tickets e contatos da sua carteira.
*   **Conexões:**
    *   ✅ Vê/Usa apenas as conexões explicitamente **LIBERADAS** para ele.
    *   🚀 **Seleção Automática:** Se tiver apenas 1 conexão liberada, o sistema seleciona automaticamente.

---

## 2. Mapa Visual da Hierarquia

```mermaid
flowchart TD
    %% Classes de Estilo
    classDef super fill:#ff4444,stroke:#333,stroke-width:2px,color:white;
    classDef sup fill:#ffbb33,stroke:#333,stroke-width:2px,color:black;
    classDef user fill:#00C851,stroke:#333,stroke-width:2px,color:white;
    classDef resource fill:#33b5e5,stroke:#333,stroke-width:1px,color:white,stroke-dasharray: 5 5;
    classDef private fill:#2E2E2E,stroke:#333,stroke-width:1px,color:white;

    subgraph Nivel1 [👑 Super Admin]
        direction TB
        Admin(Super Admin)
        GhostSwitch{Ghost Mode Ativado?}
        PrivateConn[📱 Conexão Particular]:::private
        
        Admin --> GhostSwitch
        Admin -->|Dono| PrivateConn
        Admin -->|Controla| ConnectionTable[📋 Tabela de Liberação de Conexões]:::resource
    end

    subgraph Nivel2 [👮 Supervisor]
        direction TB
        Supervisor(Supervisor)
        TeamData[📂 Dados da Equipe]:::resource
        
        Supervisor -->|Gerencia| TeamData
        Supervisor -.->|❌ BLOQUEADO| PrivateConn
    end

    subgraph Nivel3 [👤 Usuário]
        direction TB
        User(Usuário Comum)
        MyData[📂 Meus Dados]:::resource
    end

    %% Relações de Visibilidade
    GhostSwitch -- SIM -->|Oculta Tudo| Supervisor
    GhostSwitch -- NÃO -->|Visível| Supervisor
    
    %% Relações de Conexão
    ConnectionTable -->|Libera ID 1, 2| Supervisor
    ConnectionTable -->|Libera ID 2| User
    
    %% Legenda Visual
    class Admin super;
    class Supervisor sup;
    class User user;
```

---

## 3. Mudanças Estruturais (Schema)

### Tabela `Users`
Adicionaremos os seguintes campos:

| Campo                  | Tipo             | Descrição                                  |
| :--------------------- | :--------------- | :----------------------------------------- |
| `allowedConnectionIds` | `ARRAY(Integer)` | IDs de conexões liberadas. (Ex: `[1, 2]`). |
| `isPrivate`            | `Boolean`        | Flag para o "Ghost Mode" do Admin.         |

### Lógica de Backend
1.  **Middleware/Service:** Ao listar conexões, verificar `user.allowedConnectionIds`.
2.  **Envio de Mensagem:** Bloquear envio se `connectionId` não estiver na lista permitida.

---

## 4. Plano de Execução

1.  **Banco de Dados:** Criar migration para adicionar colunas.
2.  **Backend:** Ajustar Models e Controllers de envio/listagem.
3.  **Frontend:** Criar UI para Admin liberar conexões na tela de Usuários.
