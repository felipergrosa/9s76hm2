# Auto-Heal para Bad MAC / CIPHERTEXT

## Problema Raiz

```mermaid
flowchart LR
    A["Bad MAC<br/>Sessão corrompida"] --> B["Retry falha"]
    B --> C["xml-not-well-formed"]
    C --> D["Conexão crash"]
    D --> E["Reconexão automática"]
    E --> A
```

A sessão criptográfica de `192126906318972@lid` estava corrompida, criando um **loop infinito** de crashes.

## Mudanças

### 1. Fix `wbotMonitor` — `wbot.ts`

```diff
-wbotMonitor(whatsapp, companyId, whatsapp.id);
+wbotMonitor(wsocket, whatsapp, companyId);
```

### 2. Auto-Heal — `wbotMessageListener.ts`

```mermaid
flowchart TD
    A["Mensagem CIPHERTEXT<br/>detectada"] --> B{"Cooldown<br/>5min ativo?"}
    B -- Não --> C["ClearContactSessionService"]
    C --> D["Sessão limpa no Redis"]
    D --> E["Baileys re-negocia<br/>chaves na próxima msg"]
    B -- Sim --> F["Ignorar<br/>já tratado"]
```

- `filterMessages` → `createFilterMessages(whatsappId)` (factory com closure)
- `badMacAutoHealMap`: cooldown de 5 min por `whatsappId:remoteJid`
- Usa `ClearContactSessionService` (suporte Redis)

## Logs esperados

```
WARN [AUTO-HEAL] Detectado Bad MAC para whatsappId=26, contact=192126906318972@lid. Limpando sessão corrompida...
INFO [AUTO-HEAL] Resultado: Sessão limpa com sucesso (redis): 3 arquivos removidos.
```
