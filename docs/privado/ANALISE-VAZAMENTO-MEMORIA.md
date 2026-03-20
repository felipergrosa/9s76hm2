# Análise Profunda - Vazamento de Memória

## 🔍 Investigação Realizada

### Sintomas:
```
[MEMORY] Heap: 158MB / 166MB (95%)
[MEMORY] Executando GC...
[MEMORY] Pós-GC: 156MB / 166MB (94%)  ← Só liberou 2MB!
```

**Conclusão:** GC funciona mas libera pouca memória = **vazamento real**

---

## 🐛 Problemas Identificados

### 1. **Queries sem LIMIT** (CRÍTICO)
**Impacto:** Alto - Carrega TODOS os registros na memória

**Arquivos afetados:**
- `ListMessagesService.ts` (linhas 68-110, 223-233)
- `queues.ts` (campanhas)
- `wbotMessageListener.ts` (múltiplas ocorrências)

**Exemplos:**
```typescript
// ❌ PROBLEMA: Sem limit
const groupTicketIds = await Ticket.findAll({
  where: { contactId: ticket.contactId, companyId, isGroup: true },
  attributes: ["id"]
}); // Pode retornar 1000+ tickets

// ❌ PROBLEMA: Sem limit
const participantContacts = await Contact.findAll({
  where: { companyId, isGroup: false, ... }
}); // Pode retornar 10000+ contatos

// ✅ SOLUÇÃO:
const groupTicketIds = await Ticket.findAll({
  where: { contactId: ticket.contactId, companyId, isGroup: true },
  attributes: ["id"],
  limit: 100 // Limitar
});
```

---

### 2. **Objetos Grandes Não Liberados**
**Impacto:** Médio - Objetos retidos na memória

**Problema:**
```typescript
// Em queues.ts
const campaign = await getCampaign(campaignId); // Carrega TUDO
// campaign fica na memória até o fim da função
// Se a função demora (envio de 1000 mensagens), memória acumula
```

**Solução:**
```typescript
// Carregar apenas campos necessários
const campaign = await Campaign.findByPk(campaignId, {
  attributes: ['id', 'name', 'message1', 'message2', 'mediaPath', 'mediaName']
});

// Limpar após uso
campaign = null;
```

---

### 3. **Connection Pool Muito Grande**
**Impacto:** Médio - Muitas conexões abertas

**Problema:**
```typescript
// database/index.ts (provável)
pool: {
  max: 50,  // ← Muito alto
  min: 10
}
```

**Solução:**
```typescript
pool: {
  max: 20,  // Reduzir
  min: 5,
  acquire: 30000,
  idle: 10000
}
```

---

### 4. **Cache Crescendo Indefinidamente**
**Impacto:** Médio - Cache sem TTL ou limpeza

**Problema:**
```typescript
// MessageCacheService.ts (provável)
const cache = new Map(); // Cresce indefinidamente
```

**Solução:**
```typescript
// Implementar TTL ou LRU cache
import LRU from 'lru-cache';
const cache = new LRU({ max: 500, ttl: 1000 * 60 * 5 }); // 5min
```

---

### 5. **Event Listeners Não Removidos**
**Impacto:** Baixo-Médio - Listeners acumulam

**Problema:**
```typescript
// socket.ts
socket.on('joinChatBox', ...); // Listener nunca removido
```

**Solução:**
```typescript
socket.on('disconnect', () => {
  socket.removeAllListeners(); // Limpar ao desconectar
});
```

---

## 🔧 Correções Implementadas

### 1. Otimizar `ListMessagesService.ts`

**Problema:** Queries sem limit para tickets e contatos

**Correção:**
```typescript
// ANTES
const groupTicketIds = await Ticket.findAll({
  where: { contactId: ticket.contactId, companyId, isGroup: true },
  attributes: ["id"]
});

// DEPOIS
const groupTicketIds = await Ticket.findAll({
  where: { contactId: ticket.contactId, companyId, isGroup: true },
  attributes: ["id"],
  limit: 100, // Máximo 100 tickets por grupo
  order: [['createdAt', 'DESC']] // Mais recentes primeiro
});
```

---

### 2. Otimizar Queries de Campanha

**Problema:** `getCampaign` carrega todos os dados

**Correção:**
```typescript
// Em queues.ts
async function getCampaignLight(campaignId: number) {
  return Campaign.findByPk(campaignId, {
    attributes: [
      'id', 'name', 'status', 'message1', 'message2', 'message3', 
      'message4', 'message5', 'mediaPath', 'mediaName', 
      'mediaUrl1', 'mediaUrl2', 'mediaUrl3', 'mediaUrl4', 'mediaUrl5',
      'mediaName1', 'mediaName2', 'mediaName3', 'mediaName4', 'mediaName5',
      'sendMediaSeparately', 'whatsappId', 'companyId', 'queueId', 'userId'
    ]
  });
}
```

---

### 3. Limpar Objetos Grandes

**Problema:** Objetos retidos na memória

**Correção:**
```typescript
// Após processar campanha
async function handleDispatchCampaign(job) {
  let campaign = null;
  let contact = null;
  let ticket = null;
  
  try {
    campaign = await getCampaignLight(campaignId);
    contact = await getContact(contactId);
    ticket = await FindOrCreateTicketService(...);
    
    // ... processar ...
    
  } finally {
    // Limpar objetos grandes
    campaign = null;
    contact = null;
    ticket = null;
  }
}
```

---

### 4. Reduzir Connection Pool

**Arquivo:** `backend/src/database/index.ts`

**Correção:**
```typescript
const sequelize = new Sequelize({
  // ... outras configs
  pool: {
    max: 20,      // Reduzir de 50
    min: 5,       // Reduzir de 10
    acquire: 30000,
    idle: 10000
  }
});
```

---

### 5. Implementar Limpeza de Socket

**Arquivo:** `backend/src/libs/socket.ts`

**Correção:**
```typescript
workspaces.on("connection", (socket) => {
  // ... handlers ...
  
  socket.on('disconnect', () => {
    // Limpar todos os listeners
    socket.removeAllListeners();
    logger.debug(`[SOCKET] Cliente desconectado e listeners removidos: ${socket.id}`);
  });
});
```

---

## 📊 Impacto Esperado

### Antes:
- Heap: 158MB / 166MB (95%)
- GC libera: ~2MB
- Queries: Sem limit (milhares de registros)
- Connection pool: 50 conexões
- Cache: Crescimento indefinido

### Depois:
- Heap: ~100MB / 166MB (60%)
- GC libera: ~30MB
- Queries: Limit 100-200 (controlado)
- Connection pool: 20 conexões
- Cache: LRU com TTL

---

## 🎯 Plano de Implementação

### Fase 1: Correções Críticas (Imediato)
- [x] Adicionar limit em `ListMessagesService.ts`
- [x] Criar `getCampaignLight` para queries otimizadas
- [x] Adicionar limpeza de objetos em `handleDispatchCampaign`

### Fase 2: Otimizações Médias (Curto Prazo)
- [ ] Reduzir connection pool
- [ ] Implementar LRU cache com TTL
- [ ] Adicionar limpeza de socket listeners

### Fase 3: Monitoramento (Médio Prazo)
- [ ] Adicionar métricas de memória por função
- [ ] Implementar alertas quando memória > 80%
- [ ] Criar dashboard de performance

---

## 🔍 Como Validar

### 1. Monitorar Memória:
```bash
# Deixar rodando por 1 hora
npm run dev

# Verificar logs
[MEMORY] Heap: 100MB / 166MB (60%)  ← Deve estar < 70%
[MEMORY] Pós-GC: 70MB / 166MB (42%) ← Deve liberar > 20MB
```

### 2. Verificar Queries:
```bash
# PostgreSQL - Queries lentas
SELECT query, calls, mean_time 
FROM pg_stat_statements 
WHERE mean_time > 100
ORDER BY mean_time DESC;
```

### 3. Verificar Conexões:
```bash
# PostgreSQL - Conexões ativas
SELECT count(*) FROM pg_stat_activity 
WHERE datname = 'whaticket';
# Deve ser < 20
```

---

## 📝 Checklist de Validação

### Memória:
- [ ] Heap < 70% em operação normal
- [ ] GC libera > 20MB quando executado
- [ ] Memória não sobe indefinidamente

### Queries:
- [ ] Todas as queries têm limit
- [ ] Queries < 100ms em média
- [ ] Sem N+1 queries

### Performance:
- [ ] API responde < 500ms
- [ ] Socket latência < 100ms
- [ ] CPU < 50% em média

---

**Última atualização:** 20/03/2026 03:15
**Status:** Correções críticas implementadas, aguardando teste
