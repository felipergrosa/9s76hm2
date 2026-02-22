# 🔍 Diagnóstico: Mensagens Não Chegam no Whaticket

## Problema
Mensagens enviadas para o número +5519992461008 não aparecem no frontend do Whaticket.

## Cenário
- **PROD + DEV** rodando com o **mesmo número** WhatsApp
- Sistema Multi-Device com eleição de líder via Redis

---

## 📋 Passo 1: Verificar Logs do Backend

### 1.1 Verificar se mensagens chegam no backend
```bash
# Procure por estes logs no terminal do backend:
grep "messages.upsert" logs.txt
grep "handleMessage" logs.txt
```

**Logs esperados:**
```
[messages.upsert] Evento recebido: 1 mensagens, type=notify, whatsappId=X
[messages.upsert] Após filtro: 1 mensagens válidas
```

**Se NÃO aparecer:** O problema é na conexão WhatsApp (QR code, sessão, etc.)

---

### 1.2 Verificar eleição de líder
```bash
grep "LÍDER\|FOLLOWER" logs.txt
```

**Logs esperados:**
```
[wbotMessageListener] ✅ Esta conexão é LÍDER para 5519992461008
```
OU
```
[wbotMessageListener] ⚠️ Esta conexão é FOLLOWER para 5519992461008
```

**⚠️ CRÍTICO:** Se AMBAS as instâncias (PROD + DEV) forem FOLLOWER, nenhuma processará mensagens!

---

### 1.3 Verificar Redis
```bash
# Verifique se Redis está acessível
redis-cli ping
# Deve retornar: PONG

# Verificar chave de líder
redis-cli get "wbot:leader:5519992461008"
# Deve retornar algo como: "instanceId:whatsappId:timestamp"
```

---

## 📋 Passo 2: Verificar Socket.IO

### 2.1 Verificar namespace
```bash
grep "workspace-" logs.txt
```

**Logs esperados:**
```
Socket.IO Redis adapter habilitado
[SOCKET AUTH] Nova conexão - Origin: http://localhost:3000
```

### 2.2 Verificar emissão de eventos
```bash
grep "appMessage\|company-.*-ticket" logs.txt
```

**Logs esperados:**
```
io.of('/workspace-1').emit('company-1-appMessage', ...)
```

---

## 📋 Passo 3: Verificar Erros

### 3.1 Verificar erros no handleMessage
```bash
grep "ERRO CRÍTICO\|Falha\|Error" logs.txt
```

### 3.2 Verificar erros de contato
```bash
grep "Contato não encontrado" logs.txt
```

---

## 🔧 Possíveis Causas e Soluções

### Causa 1: Ambas instâncias são FOLLOWER
**Sintoma:** Nenhuma processa mensagens

**Solução:**
```bash
# Verificar qual é líder
redis-cli get "wbot:leader:5519992461008"

# Se vazio ou inválido, forçar eleição
redis-cli del "wbot:leader:5519992461008"
# Reiniciar uma das instâncias
```

---

### Causa 2: Redis indisponível
**Sintoma:** Ambas assumem líder = duplicação ou nenhuma processa

**Solução:**
```bash
# Verificar se Redis está rodando
redis-cli ping

# Se não estiver, iniciar
redis-server

# Verificar configuração no .env
grep REDIS_URI .env
```

---

### Causa 3: Namespace Socket.IO incorreto
**Sintoma:** Mensagens salvas no banco mas não aparecem no frontend

**Verificar:**
- Frontend conecta em `/workspace-{companyId}`
- Backend emite em `/workspace-{companyId}`

---

### Causa 4: Erro no ContactResolverService
**Sintoma:** Mensagem chega mas contato não é criado

**Verificar:**
```bash
grep "ContactResolver" logs.txt
grep "LID-accept\|LID_CREATION_FAILED" logs.txt
```

---

## 🚀 Ação Imediata

### Script de Diagnóstico
Execute este comando no servidor:

```bash
echo "=== DIAGNÓSTICO WHATSAPP ===" && \
echo "1. Redis:" && redis-cli ping && \
echo "2. Líder atual:" && redis-cli get "wbot:leader:5519992461008" && \
echo "3. Últimas mensagens:" && tail -100 logs.txt | grep -E "messages.upsert|handleMessage|LÍDER|FOLLOWER|appMessage" && \
echo "=== FIM DIAGNÓSTICO ==="
```

---

## 📞 Próximos Passos

1. **Executar diagnóstico** acima
2. **Enviar resultado** dos logs
3. **Verificar** se Redis está acessível por AMBAS instâncias
4. **Confirmar** qual instância é líder

---

## ⚠️ IMPORTANTE: Multi-Device com Mesmo Número

Quando você tem **PROD + DEV** com o **mesmo número WhatsApp**:

1. **Apenas UMA instância processa mensagens** (líder)
2. **A outra apenas sincroniza histórico** (follower)
3. **Redis é OBRIGATÓRIO** para coordenar eleição
4. **Se Redis falhar**, ambas assumem líder = duplicação

### Configuração correta:
```env
# AMBAS as instâncias devem ter:
REDIS_URI=redis://localhost:6379
SOCKET_REDIS_URL=redis://localhost:6379
```
