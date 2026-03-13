# 🐛 ANÁLISE DE PERFORMANCE DO FRONTEND

## 🚨 PROBLEMAS IDENTIFICADOS:

### 1. **Excesso de Listeners Socket.IO**
- **Múltiplos listeners** por página (Kanban, Contacts, etc.)
- **Listeners não removidos** corretamente em alguns casos
- **Reconexões** causam re-registro de listeners

### 2. **State Management Ineficiente**
- **Múltiplos useEffect** sem dependências otimizadas
- **Renderizações desnecessárias** a cada evento
- **Arrays grandes** sendo processados sem otimização

### 3. **Falta de Memoização**
- **Cálculos repetidos** (userOptions, tagOptions)
- **Funções recriadas** a cada render
- **Listas grandes** sem virtualização

### 4. **Polling Excessivo**
- **fetchTickets** chamado repetidamente
- **Sem cache** das requisições
- **Re-render** completo a cada atualização

## 🚀 SOLUÇÕES PROPOSTAS:

### 1. Otimizar SocketWorker

**Problema**: Listeners duplicados e reconexões ineficientes

```javascript
// Em SocketWorker.js - Adicionar debounce
const debounceReconnect = debounce(() => {
  this.reconnectAfterDelay();
}, 1000);

// Limpar listeners antigos antes de adicionar
on(event, callback) {
  this.connect();
  
  // Remover listener anterior se existir
  if (this.eventListeners[event]) {
    this.eventListeners[event].forEach(cb => {
      this.socket.off(event, cb);
    });
  }
  
  this.socket.on(event, callback);
  this.eventListeners[event] = [callback];
}
```

### 2. Memoizar Componentes Pesados

**Problema**: Re-render completo a cada evento

```javascript
// Em Kanban/index.js
const userOptions = useMemo(() => {
  const map = new Map();
  tickets.forEach(t => {
    const id = String(t.user?.id || t.userId || '');
    const name = t.user?.name || (id ? `Usuário ${id}` : '');
    if (id) map.set(id, name);
  });
  return Array.from(map, ([id, name]) => ({ id, name }));
}, [tickets]); // OK

// Adicionar memoização do componente
const KanbanColumn = React.memo(({ column, tickets, onDrop }) => {
  // Componente pesado memoizado
});
```

### 3. Implementar Cache de Requisições

**Problema**: fetchTickets chamado sem cache

```javascript
// Cache simples para tickets
const ticketsCache = new Map();
const CACHE_TTL = 30000; // 30 segundos

const fetchTicketsWithCache = useCallback(async () => {
  const cacheKey = `${jsonString}-${startDate}-${endDate}-${viewingUserId}`;
  const cached = ticketsCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    setTickets(cached.data);
    return cached.data;
  }
  
  try {
    const { data } = await api.get("/ticket/kanban", {
      params: { queueIds: JSON.stringify(jsonString), startDate, endDate, viewingUserId }
    });
    
    ticketsCache.set(cacheKey, { data: data.tickets, timestamp: Date.now() });
    setTickets(data.tickets);
    return data.tickets;
  } catch (err) {
    console.log(err);
    setTickets([]);
    return [];
  }
}, [jsonString, startDate, endDate, viewingUserId]);
```

### 4. Virtualizar Listas Grandes

**Problema**: Listas com muitos itens causam lentidão

```javascript
// Usar react-window ou react-virtualized
import { FixedSizeList as List } from 'react-window';

const VirtualizedTicketList = ({ tickets }) => (
  <List
    height={600}
    itemCount={tickets.length}
    itemSize={80}
    itemData={tickets}
  >
    {({ index, style, data }) => (
      <div style={style}>
        <TicketItem ticket={data[index]} />
      </div>
    )}
  </List>
);
```

### 5. Otimizar useEffect

**Problema**: Múltiplos useEffect sem otimização

```javascript
// Em TicketsManagerTabs/index.js
useEffect(() => {
  if (tab === "search") {
    searchInputRef.current?.focus();
  }
  setForceSearch(prev => !prev); // Usar função para evitar race conditions
}, [tab]); // OK

// Combinar useEffects relacionados
useEffect(() => {
  setSelectedQueuesMessage(selectedQueueIds);
  // Outros efeitos relacionados
}, [selectedQueueIds]); // OK
```

### 6. Debounce de Eventos

**Problema**: Muitas atualizações rápidas

```javascript
// Adicionar debounce para busca
const debouncedSearch = useMemo(
  () => debounce((value) => {
    setSearchParam(value);
    setForceSearch(prev => !prev);
  }, 300),
  []
);

// Limpar debounce no unmount
useEffect(() => {
  return () => {
    debouncedSearch.cancel();
  };
}, [debouncedSearch]);
```

### 7. Lazy Loading de Componentes

**Problema**: Componentes pesados carregados de uma vez

```javascript
// Lazy loading para componentes pesados
const TicketsList = React.lazy(() => import('../TicketsListCustom'));
const NewTicketModal = React.lazy(() => import('../NewTicketModal'));

// Usar Suspense
<Suspense fallback={<div>Carregando...</div>}>
  <TicketsList />
</Suspense>
```

## 📊 MELHORIAS ESPERADAS:

- ⚡ **40-60% mais rápido** em navegação
- 🔄 **Menos re-renders**
- 📱 **UI mais responsiva**
- 🗄️ **Menos requisições repetidas**

## 🔧 CONFIGURAÇÕES ADICIONAIS:

### React DevTools Profiler
```javascript
// Adicionar em desenvolvimento
import { Profiler } from 'react';

<Profiler id="Kanban" onRender={(id, phase, actualDuration) => {
  console.log('Kanban render:', { phase, actualDuration });
}}>
  <Kanban />
</Profiler>
```

### Web Workers para processamento pesado
```javascript
// Mover processamento de arrays para Web Worker
const worker = new Worker('/workers/ticketProcessor.js');
worker.postMessage({ tickets: largeArray });
```

## ⚠️ IMPLEMENTAÇÃO GRADUAL:

1. **Começar com cache** de requisições (impacto alto, risco baixo)
2. **Adicionar memoização** nos componentes principais
3. **Otimizar SocketWorker** (impacto médio, risco médio)
4. **Implementar virtualização** para listas grandes

## 🎯 PRIORIDADES:

1. **Alta**: Cache de requisições API
2. **Alta**: Memoização de componentes pesados
3. **Média**: Otimização de useEffect
4. **Média**: Debounce de eventos
5. **Baixa**: Virtualização de listas
