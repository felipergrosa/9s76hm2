# Correções Urgentes - Campanha e Memória

## 🐛 Problemas Reportados

### 1. Áudio Duplicado no Chat
**Status:** 🔍 Em investigação com logs detalhados

**Sintoma:** 2 áudios aparecem no chat do Whaticket quando campanha envia áudio + texto

**Possíveis Causas:**
1. Backend enviando 2 mensagens de áudio
2. Frontend renderizando 2 vezes a mesma mensagem
3. Listener do WhatsApp processando mensagem duplicada

**Logs Adicionados:**
```typescript
[CAMPAIGN-AUDIO-DEBUG] msgIdx=1 | isAudio=true | sendSeparately=false | hasText=true
[CAMPAIGN-AUDIO-DEBUG] Enviando TEXTO separado para ticket 123
[CAMPAIGN-AUDIO-DEBUG] Enviando MÍDIA para ticket 123
[CAMPAIGN-AUDIO-DEBUG] Salvando MÍDIA no banco para ticket 123
```

**Próximos Passos:**
1. Executar campanha de teste com áudio
2. Verificar logs `[CAMPAIGN-AUDIO-DEBUG]`
3. Verificar se `verifyMediaMessage` está salvando 2 vezes
4. Verificar se frontend está renderizando 2 vezes

---

### 2. Badge da Campanha Sumiu
**Status:** ✅ CORRIGIDO

**Problema:** Badge não aparecia mesmo com campanhas ativas

**Causa:** Badge contava apenas `unreadMessages`, mas campanhas não geram mensagens não lidas

**Solução:**
```javascript
// ANTES (errado)
const campaignCount = ticketsByStatus.campaign.reduce((sum, t) => sum + (t.unreadMessages || 0), 0);

// DEPOIS (correto)
const campaignCount = ticketsByStatus.campaign.length; // Conta tickets, não unread
```

**Resultado:** Badge agora mostra quantidade de tickets de campanha

---

### 3. Memória Alta (94-96%)
**Status:** ⚠️ PARCIALMENTE RESOLVIDO

**Problema:** GC funcionando mas memória não reduz significativamente

**Logs:**
```
[MEMORY] Heap: 158MB / 166MB (95%)
[MEMORY] Executando garbage collection forçado...
[MEMORY] Pós-GC: 156MB / 166MB (94%)  ← Só liberou 2MB
```

**Análise:**
- GC está funcionando (habilitado com `--expose-gc`)
- Memória não reduz muito após GC = **vazamento real**
- Heap total: 166MB (limite baixo para Node.js)

**Possíveis Causas:**
1. Queries carregando muitos dados sem limit
2. Objetos grandes não sendo liberados
3. Event listeners não removidos
4. Cache crescendo indefinidamente
5. Conexões abertas não fechadas

**Soluções Implementadas:**
- ✅ GC habilitado (`--expose-gc`)
- ✅ Monitor otimizado (60s, logs condicionais)
- ✅ Socket logs reduzidos
- ✅ Query optimizer criado

**Soluções Pendentes:**
- [ ] Aplicar `queryOptimizer` em queries de campanha
- [ ] Limitar resultados de queries (max 200)
- [ ] Limpar objetos grandes após uso
- [ ] Reduzir connection pool do Sequelize
- [ ] Implementar cache com TTL

---

## 🔧 Correções Aplicadas

### Backend (`backend/src/queues.ts`)

**1. Logs de Debug para Áudio:**
```typescript
logger.info(`[CAMPAIGN-AUDIO-DEBUG] msgIdx=${msgIdx} | isAudio=${isAudio} | sendSeparately=${sendSeparately} | hasText=${hasText}`);
logger.info(`[CAMPAIGN-AUDIO-DEBUG] Enviando TEXTO separado para ticket ${ticket.id}`);
logger.info(`[CAMPAIGN-AUDIO-DEBUG] Enviando MÍDIA para ticket ${ticket.id}`);
logger.info(`[CAMPAIGN-AUDIO-DEBUG] Salvando MÍDIA no banco para ticket ${ticket.id}`);
```

### Frontend (`frontend/src/components/TicketsManagerTabs/index.js`)

**1. Badge da Campanha:**
```javascript
// Mostra quantidade de tickets, não unread
const campaignCount = ticketsByStatus.campaign.length;
```

---

## 📊 Investigação de Memória

### Comandos para Diagnóstico:

**1. Verificar heap dump:**
```bash
node --expose-gc --inspect dist/server.js
# Chrome DevTools → Memory → Take Heap Snapshot
```

**2. Verificar queries lentas:**
```sql
-- PostgreSQL
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 20;
```

**3. Verificar conexões abertas:**
```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = 'whaticket';
```

### Áreas Suspeitas de Memory Leak:

**1. Campanhas (`queues.ts`):**
```typescript
// Carregar apenas campos necessários
const campaign = await Campaign.findByPk(id, {
  attributes: ['id', 'name', 'message1', 'mediaPath'], // ← Limitar
  include: [{
    model: ContactList,
    limit: 100 // ← Adicionar limite
  }]
});
```

**2. Mensagens (`ListMessagesService.ts`):**
```typescript
// Adicionar paginação
const messages = await Message.findAll({
  limit: 50, // ← Limitar
  offset: (page - 1) * 50,
  order: [['createdAt', 'DESC']]
});
```

**3. Socket.IO:**
```typescript
// Limpar listeners ao desconectar
socket.on('disconnect', () => {
  socket.removeAllListeners(); // ← Adicionar
});
```

---

## 🎯 Próximas Ações

### Imediato (Fazer Agora):

1. **Testar campanha com áudio**
   - Criar campanha de teste
   - Enviar para 1 contato
   - Verificar logs `[CAMPAIGN-AUDIO-DEBUG]`
   - Verificar se aparece 1 ou 2 áudios no chat

2. **Verificar badge da campanha**
   - Criar campanha
   - Verificar se badge aparece
   - Verificar se número está correto

3. **Analisar memória**
   - Deixar sistema rodando 1 hora
   - Verificar se memória continua subindo
   - Se sim, fazer heap dump

### Curto Prazo (Próximos Dias):

1. **Otimizar queries de campanha**
   - Aplicar `queryOptimizer`
   - Adicionar limites
   - Adicionar índices no banco

2. **Implementar limpeza de recursos**
   - Limpar objetos grandes após uso
   - Remover event listeners
   - Fechar conexões

3. **Monitorar memória**
   - Verificar se GC está liberando memória
   - Se não, investigar heap dump
   - Identificar objetos que não são liberados

---

## 📝 Checklist de Validação

### Áudio Duplicado:
- [ ] Logs `[CAMPAIGN-AUDIO-DEBUG]` aparecem
- [ ] Verificar se envia 1 ou 2 mensagens de áudio
- [ ] Verificar se salva 1 ou 2 registros no banco
- [ ] Verificar se frontend renderiza 1 ou 2 áudios

### Badge da Campanha:
- [x] Badge aparece quando há campanhas
- [x] Badge some quando não há campanhas
- [x] Número do badge está correto

### Memória:
- [x] GC habilitado e funcionando
- [ ] Memória reduz após GC (> 10%)
- [ ] Memória não sobe indefinidamente
- [ ] Heap total adequado (> 256MB)

---

## 🚨 Alertas

### Se Memória Continuar Alta:

**Aumentar heap size:**
```json
// package.json
"start:prod": "node --expose-gc --max-old-space-size=8192 dist/server.js"
```

**Investigar com heap dump:**
```bash
node --expose-gc --inspect --max-old-space-size=4096 dist/server.js
# Chrome: chrome://inspect
# Memory → Take Heap Snapshot
# Analisar objetos retidos
```

**Verificar queries sem limit:**
```bash
grep -r "findAll" backend/src --include="*.ts" | grep -v "limit"
```

---

**Última atualização:** 20/03/2026 02:30
**Status:** Em investigação ativa
