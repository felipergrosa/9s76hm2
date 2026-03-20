# Solução: Memória Alta - Heap Limitado

## 🔍 Diagnóstico Correto

### Logs Analisados:
```
[MEMORY] Heap: 158MB / 166MB (95%)
[MEMORY] Executando GC...
[MEMORY] Pós-GC: 156MB / 166MB (94%)

[MEMORY] Heap: 162MB / 173MB (94%)
[MEMORY] Executando GC...
[MEMORY] Pós-GC: 156MB / 171MB (91%)
```

### ❌ Diagnóstico INCORRETO Inicial:
"Vazamento de memória porque GC libera pouco"

### ✅ Diagnóstico CORRETO:
**Heap total está limitado a ~170MB** (deveria ser 4096MB)

## 🐛 Causa Raiz

O `--max-old-space-size=4096` está configurado mas **não está sendo aplicado**.

**Motivo:** `ts-node-dev` pode ignorar ou sobrescrever flags do Node.js

**Evidência:**
- Configurado: `--max-old-space-size=4096` (4GB)
- Real: Heap total = 166-173MB
- Conclusão: Flag não está sendo aplicada

## ✅ Solução Implementada

### Mudança no `package.json`:

**ANTES:**
```json
"dev": "ts-node-dev --respawn --transpile-only --expose-gc --max-old-space-size=4096 src/server.ts"
```

**DEPOIS:**
```json
"dev": "node --expose-gc --max-old-space-size=4096 -r ts-node/register/transpile-only src/server.ts"
```

### Por que funciona:
- `node` recebe as flags **diretamente**
- `-r ts-node/register/transpile-only` carrega TypeScript como require hook
- Flags são aplicadas **antes** de carregar o código

## 📊 Resultado Esperado

### Antes:
```
Heap total: 166-173MB (LIMITADO)
Heap usado: 156-162MB
Uso: 92-95% (CRÍTICO)
```

### Depois:
```
Heap total: 4096MB (4GB disponível)
Heap usado: 156-200MB
Uso: 4-5% (NORMAL)
```

## 🔧 Como Aplicar

### 1. Parar o backend atual:
```bash
# Ctrl+C no terminal
```

### 2. Reiniciar com novo comando:
```bash
cd backend
npm run dev
```

### 3. Verificar logs:
```bash
# Deve aparecer:
[MEMORY] Heap: 160MB / 4096MB (4%)  ← Heap total MUITO maior
```

## 📝 Validação

### Checklist:
- [ ] Heap total > 1000MB (não mais ~170MB)
- [ ] Uso de memória < 20%
- [ ] GC não dispara constantemente
- [ ] Sem logs de memória crítica

### Comandos de Verificação:

**Verificar heap atual:**
```javascript
// No código (temporário para debug)
console.log('Heap:', Math.round(process.memoryUsage().heapTotal / 1024 / 1024), 'MB');
```

**Monitorar por 10 minutos:**
- Heap total deve permanecer > 1GB
- Uso deve ficar < 30%
- Sem alertas críticos

## 🎯 Outras Otimizações Mantidas

As otimizações de queries continuam válidas:

1. ✅ Queries com `limit: 100-200`
2. ✅ `getCampaignLight()` para reduzir payload
3. ✅ Monitor otimizado (60s, logs > 70%)
4. ✅ `--expose-gc` habilitado

## ⚠️ Se Problema Persistir

### Cenário 1: Heap continua baixo (~170MB)
**Causa:** Flag ainda não aplicada
**Solução:** Usar `NODE_OPTIONS`:
```bash
export NODE_OPTIONS="--expose-gc --max-old-space-size=4096"
npm run dev
```

### Cenário 2: Heap alto mas uso > 80%
**Causa:** Vazamento real de memória
**Solução:** Aplicar Fase 2 e 3 do `ANALISE-VAZAMENTO-MEMORIA.md`:
- Reduzir connection pool
- Implementar LRU cache
- Analisar heap dump

### Cenário 3: ts-node não funciona
**Causa:** Módulo não instalado
**Solução:**
```bash
npm install --save-dev ts-node
```

## 📚 Referências

- [Node.js Memory Management](https://nodejs.org/en/docs/guides/simple-profiling/)
- [V8 Heap Limits](https://nodejs.org/api/cli.html#--max-old-space-sizesize-in-megabytes)
- [ts-node Documentation](https://typestrong.org/ts-node/)

## 🔄 Alternativas

### Opção 1: Usar nodemon (sem hot reload)
```json
"dev": "nodemon --exec 'node --expose-gc --max-old-space-size=4096 -r ts-node/register' src/server.ts"
```

### Opção 2: Usar tsx (mais rápido)
```bash
npm install --save-dev tsx
```
```json
"dev": "node --expose-gc --max-old-space-size=4096 --loader tsx src/server.ts"
```

### Opção 3: Compilar e rodar (mais estável)
```json
"dev": "npm run build && node --expose-gc --max-old-space-size=4096 dist/server.js"
```

---

**Última atualização:** 20/03/2026 03:25
**Status:** Solução implementada, aguardando reinício do backend
**Prioridade:** CRÍTICA - Resolver antes de continuar outras otimizações
