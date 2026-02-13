# Refatoração: Importação de Histórico com `fetchMessageHistory` do Baileys

## Problema Resolvido

Os botões "Importar Histórico" e "Ressincronizar Conversa" usavam apenas `store.loadMessages()` 
(cache local do Baileys), que contém ~50-100 mensagens recentes. 
Mensagens antigas do celular nunca apareciam no Whaticket.

## Solução: Duas Fases

```mermaid
flowchart TD
    Start[Início Importação] --> F1[Fase 1: Cache Local]
    F1 --> |store.loadMessages| Cache[Mensagens do Cache ~50-100]
    Cache --> F2[Fase 2: Servidor WhatsApp]
    F2 --> |fetchMessageHistory| Server[Solicita batches de 50]
    Server --> Handler[Handler messaging-history.set]
    Handler --> |Filtra por JID| Filter[Mensagens do Contato]
    Filter --> |Mais disponíveis?| Server
    Filter --> |Esgotou ou cutoff| Dedup[Deduplicação por key.id]
    Dedup --> Import[Importação com Download de Mídia]
    Import --> Done[COMPLETED]
```

## Tipos de Mensagem Importados

| Categoria | Tipos |
|---|---|
| Texto | `conversation`, `extendedTextMessage` |
| Mídia | `imageMessage`, `videoMessage`, `audioMessage`, `voiceMessage`, `ptvMessage` |
| Documentos | `documentMessage`, `documentWithCaptionMessage` |
| Stickers | `stickerMessage` |
| Contatos | `contactMessage`, `contactsArrayMessage` |
| Localização | `locationMessage`, `liveLocationMessage` |
| Reações | `reactionMessage` |
| Enquetes | `pollCreationMessage`, `pollUpdateMessage` |
| ViewOnce | `viewOnceMessage`, `viewOnceMessageV2`, `viewOnceMessageV2Extension` |
| Botões/Listas | `buttonsMessage`, `listMessage` e respostas |
| Efêmeras | `ephemeralMessage` |
| Editadas | `editedMessage`, `protocolMessage` |

## Bug Corrigido: Deleção de Mensagens

```mermaid
flowchart LR
    Delete[Usuário deleta msg] --> Backend[Backend: sendMessage delete]
    Backend --> WA[WhatsApp: Apaga do aparelho]
    Backend --> DB[DB: isDeleted = true]
    DB --> Socket[Socket: action=update]
    Socket --> |ANTES| Bug[UPDATE_MESSAGE: mostra 'Msg Apagada']
    Socket --> |DEPOIS| Fix[DELETE_MESSAGE: remove do chat]
```

## Arquivos Alterados

- `backend/src/services/MessageServices/ImportContactHistoryService.ts` — Refatoração completa
- `frontend/src/components/MessagesList/index.js` — Fix deleção de mensagens
