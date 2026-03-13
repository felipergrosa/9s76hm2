# Arquitetura de Performance - Tela de Tickets

Abaixo está o mapa de fluxo das otimizações implementadas para garantir a fluidez da tela de tickets.

```mermaid
graph TD
    Socket[Socket.IO Events] --> Buffer{Event Buffer 100ms}
    Buffer -->|Flush| Dispatch[Dispatch BATCH_UPSERT]
    
    subgraph useTicketsRealtimeStore
        Dispatch --> Reducer[Reducer: O(1) merge]
        Reducer --> Timestamp[Cache: _updatedAtTimestamp]
        Timestamp --> Sort[Sort: Optimized Numeric]
    end
    
    Sort --> Memo{Memo: List References}
    Memo -->|Changed Only| UI[TicketsManagerTabs / TicketsList]
    
    subgraph MessagesList
        MsgEvent[New Message] --> MsgReducer[Optimized Msg Reducer]
        MsgReducer --> MsgSort[Timestamp Sort]
        MsgSort --> MsgUI[Virtualized Rows]
    end
```

## Resumo Técnico
1. **Agrupamento**: Eventos de socket agora são processados em lotes a cada 100ms.
2. **Eficiência**: Ordenação baseada em números (timestamps cacheados) em vez de objetos Date.
3. **Escalabilidade**: Redução de re-renders globais através da preservação de referências de arrays.
