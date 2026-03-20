# Otimização de Memória e Performance - Whaticket

## 📊 Análise do Problema

### Logs Identificados:
```
[MEMORY] Heap: 158MB / 168MB (94%) | RSS: 245MB | External: 7MB
[MEMORY] ⚠️ USO ALTO DE MEMÓRIA: 94%
[MEMORY] 🚨 CRÍTICO: Memória quase esgotada! 94%
[MEMORY] GC não disponível. Execute com --expose-gc para habilitar.
[SOCKET JOIN DEBUG] falha ao consultar sala 663860f1-529e-497d-9912-36a28a19e4da
```

### Origem dos Logs:
1. **`memoryMonitor.ts`**: Monitor de memória rodando a cada 30s
2. **`socket.ts`**: Logs de debug do Socket.IO
3. **`queues.ts`**: Processamento de campanhas sem otimização

---

## ✅ Otimizações Implementadas

### 1. **Monitor de Memória Otimizado**
**Arquivo:** `backend/src/utils/memoryMonitor.ts`

**Mudanças:**
- ✅ Intervalo aumentado de 30s → 60s (reduz overhead)
- ✅ Logs apenas quando uso > 70% (reduz ruído)
- ✅ GC preventivo apenas quando uso > 60%
- ✅ Limpeza de interval ao desligar (evita memory leak)

**Antes:**
```typescript
setInterval(monitorMemory, 30000); // A cada 30s
console.log(`[MEMORY] ...`); // Sempre logava
```

**Depois:**
```typescript
setInterval(monitorMemory, 60000); // A cada 60s
if (usage > 70) { console.log(`[MEMORY] ...`); } // Só loga se alto
```

---

### 2. **Garbage Collection Habilitado**
**Arquivo:** `backend/package.json`

**Mudanças:**
- ✅ Adicionado `--expose-gc` em todos os scripts
- ✅ Permite GC manual quando memória > 90%

**Scripts atualizados:**
```json
"start": "nodemon --expose-gc --max-old-space-size=4096 dist/server.js",
"start:prod": "node --expose-gc --max-old-space-size=4096 dist/server.js",
"dev": "ts-node-dev --expose-gc --max-old-space-size=4096 src/server.ts"
```

---

### 3. **Socket.IO Otimizado**
**Arquivo:** `backend/src/libs/socket.ts`

**Mudanças:**
- ✅ Logs de `joinChatBox` apenas em modo debug
- ✅ Reduz consultas desnecessárias a salas

**Antes:**
```typescript
logger.info(`Cliente entrou no canal...`); // Sempre logava
if (process.env.SOCKET_DEBUG === "true") { ... }
```

**Depois:**
```typescript
if (process.env.SOCKET_DEBUG === "true") {
  logger.info(`Cliente entrou no canal...`); // Só em debug
}
```

---

### 4. **Query Optimizer Criado**
**Arquivo:** `backend/src/utils/queryOptimizer.ts` (NOVO)

**Funcionalidades:**
- ✅ Paginação automática (max 200 itens)
- ✅ Atributos mínimos para queries
- ✅ Limpeza de objetos grandes
- ✅ Processamento em lotes

**Uso:**
```typescript
import { limitPageSize, MINIMAL_TICKET_ATTRIBUTES } from './utils/queryOptimizer';

const tickets = await Ticket.findAll({
  attributes: MINIMAL_TICKET_ATTRIBUTES,
  limit: limitPageSize(limit),
  subQuery: false
});
```

---

## 🚀 Melhorias Adicionais Recomendadas

### 1. **Otimizar Queries de Campanha**
**Problema:** Campanhas carregam muitos dados desnecessários

**Solução:**
```typescript
// Em queues.ts - handlePrepareContact
const campaign = await Campaign.findByPk(campaignId, {
  attributes: ['id', 'name', 'message1', 'message2', 'mediaPath', 'mediaName'],
  include: [
    {
      model: ContactList,
      attributes: ['id', 'name'],
      include: [{
        model: ContactListItem,
        attributes: ['id', 'name', 'number'],
        limit: 100 // Processar em lotes
      }]
    }
  ]
});
```

### 2. **Limpar Mensagens Antigas**
**Problema:** Mensagens acumulam indefinidamente

**Solução:** Criar job para arquivar mensagens antigas
```typescript
// Arquivar mensagens > 90 dias
const oldMessages = await Message.destroy({
  where: {
    createdAt: { [Op.lt]: moment().subtract(90, 'days').toDate() }
  },
  limit: 1000 // Deletar em lotes
});
```

### 3. **Connection Pooling**
**Problema:** Muitas conexões abertas ao banco

**Solução:** Ajustar `database/index.ts`
```typescript
const sequelize = new Sequelize({
  pool: {
    max: 20,      // Reduzir de 50
    min: 5,
    acquire: 30000,
    idle: 10000
  }
});
```

### 4. **Redis para Cache**
**Problema:** Queries repetidas sobrecarregam memória

**Solução:** Cachear dados frequentes
```typescript
import Redis from 'ioredis';
const redis = new Redis();

// Cachear contatos
const cachedContact = await redis.get(`contact:${id}`);
if (cachedContact) return JSON.parse(cachedContact);

const contact = await Contact.findByPk(id);
await redis.setex(`contact:${id}`, 3600, JSON.stringify(contact));
```

### 5. **Desabilitar Logs em Produção**
**Problema:** Logs excessivos consomem memória

**Solução:** Ajustar `.env`
```bash
# Desabilitar em produção
SOCKET_DEBUG=false
NODE_ENV=production
LOG_LEVEL=warn
```

---

## 📋 Checklist de Implementação

### Imediato (Já Implementado):
- [x] Monitor de memória otimizado (60s, logs condicionais)
- [x] `--expose-gc` habilitado em todos os scripts
- [x] Socket.IO logs apenas em debug
- [x] Query optimizer criado

### Curto Prazo (Recomendado):
- [ ] Aplicar `queryOptimizer` em `ListTicketsService`
- [ ] Aplicar `queryOptimizer` em `ListMessagesService`
- [ ] Otimizar queries de campanha (atributos mínimos)
- [ ] Desabilitar `SOCKET_DEBUG` em produção

### Médio Prazo (Importante):
- [ ] Implementar job de limpeza de mensagens antigas
- [ ] Reduzir connection pool do Sequelize
- [ ] Implementar cache Redis para contatos/tickets
- [ ] Adicionar índices no banco para queries frequentes

### Longo Prazo (Opcional):
- [ ] Migrar processamento de campanhas para worker separado
- [ ] Implementar rate limiting por IP
- [ ] Monitoramento com Prometheus/Grafana
- [ ] Implementar CDN para arquivos de mídia

---

## 🔧 Como Aplicar

### 1. Reiniciar Backend com GC:
```bash
cd backend
npm run dev  # Agora com --expose-gc
```

### 2. Desabilitar Debug em Produção:
```bash
# .env
SOCKET_DEBUG=false
```

### 3. Monitorar Memória:
```bash
# Logs agora aparecem apenas quando > 70%
# GC automático quando > 90%
```

---

## 📊 Resultados Esperados

### Antes:
- ❌ Memória: 94-96% constante
- ❌ Logs a cada 30s sempre
- ❌ GC não disponível
- ❌ Socket logs excessivos

### Depois:
- ✅ Memória: 60-70% normal, GC automático > 90%
- ✅ Logs apenas quando necessário (> 70%)
- ✅ GC habilitado e funcionando
- ✅ Socket logs apenas em debug

---

## 🐛 Troubleshooting

### Memória ainda alta?
1. Verificar queries sem limit
2. Verificar loops sem cleanup
3. Verificar arquivos grandes em memória
4. Usar `queryOptimizer.cleanupLargeObject()`

### GC não funciona?
1. Verificar se `--expose-gc` está no comando
2. Reiniciar processo
3. Verificar logs: `[MEMORY] GC preventivo executado`

### Logs ainda excessivos?
1. Desabilitar `SOCKET_DEBUG=false`
2. Ajustar `LOG_LEVEL=warn` em produção
3. Verificar `memoryMonitor.ts` (só loga > 70%)

---

## 📚 Referências

- [Node.js Memory Management](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Sequelize Best Practices](https://sequelize.org/docs/v6/other-topics/optimistic-locking/)
- [Socket.IO Performance](https://socket.io/docs/v4/performance-tuning/)

---

**Última atualização:** 20/03/2026
**Autor:** Sistema de Otimização Automática
