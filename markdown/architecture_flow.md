# Mapa Visual da Arquitetura Distribuída

Este diagrama ilustra como o sistema gerencia conexões do WhatsApp em um ambiente com múltiplas réplicas (Docker Swarm/Kubernetes), evitando conflitos e corrupção de dados.

## Fluxo de Controle de Lock e Proteção de Escrita

```mermaid
sequenceDiagram
    participant R1 as Réplica 1 (Líder)
    participant Redis
    participant R2 as Réplica 2 (Watchdog)
    
    rect rgb(200, 255, 200)
    Note over R1,Redis: ✅ Cenário Normal (Lock Ativo)
    R1->>Redis: SETNX wbot:mutex:26 (TTL=45s)
    Redis-->>R1: OK (Lock Adquirido)
    R1->>R1: Inicia Conexão Baileys
    
    R1->>Redis: CHECK wbot:mutex:26 == Eu?
    Redis-->>R1: SIM
    R1->>Redis: Salvar Session Keys (Write Fencing)
    end

    rect rgb(255, 255, 200)
    Note over R2,Redis: 🛡️ Cenário de Proteção (Sharding Awareness)
    R2->>R2: Health Check (Cron 2min)
    R2->>R2: Verifica wbot:26 (não existe localmente)
    
    R2->>Redis: GET wbot:mutex:26
    Redis-->>R2: "Replica 1"
    
    alt Lock pertence a outro nó
        R2->>R2: LOG: "Saudável (Remoto)"
        Note over R2: 🛑 NÃO TENTA RECONECTAR
    else Lock expirou/vazio
        R2->>Redis: SETNX wbot:mutex:26
        Note over R2: 🚀 ASSUME A SESSÃO (Failover)
    end
    end

    rect rgb(255, 200, 200)
    Note over R1,Redis: ☠️ Proteção Contra Zumbis
    note right of R1: R1 travou/perdeu rede temporariamente
    R2->>Redis: Assume Lock (após TTL)
    
    R1->>R1: "Voltei!" (Zombie)
    R1->>Redis: Tenta Salvar Credenciais
    R1->>Redis: CHECK wbot:mutex:26 == Eu?
    Redis-->>R1: NÃO (Dono agora é R2)
    R1->>R1: 🛑 BLOQUEIA ESCRITA (Write Fencing)
    Note over R1: Evita corrupção "Bad MAC"
    end
```

## O que foi resolvido?

1.  **Cabo de Guerra (Tug-of-War)**: Antes, a Réplica 2 via a sessão faltando *nela* e reiniciava, derrubando a Réplica 1. Agora ela respeita o Lock Remoto.
2.  **Corrupção de Sessão (Bad MAC)**: Antes, se a Réplica 1 "acordasse" achando que ainda era dona, ela sobrescrevia as chaves novas geradas pela Réplica 2. Agora o **Write Fencing** impede isso.
