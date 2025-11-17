# 🔧 Diagnóstico e Correção do Webhook

## ❌ PROBLEMA IDENTIFICADO

**URL ERRADA!** Você está usando o domínio do FRONTEND em vez do BACKEND.

---

## 🎯 Correção Imediata

### URL Incorreta (O que você usou):
```
https://chats.nobreluminarias.com.br/webhooks/whatsapp
```
❌ **ERRADO** - Este é o frontend (porta 80, React)

### URL Correta (O que deve usar):
```
https://chatsapi.nobreluminarias.com.br/webhooks/whatsapp
```
✅ **CORRETO** - Este é o backend (porta 8080, Node.js)

---

## 🧪 Testes Para Fazer AGORA

### Teste 1: Backend Está Respondendo?

```bash
curl -I https://chatsapi.nobreluminarias.com.br
```

**Esperado:**
```
HTTP/2 200
server: nginx
```

**Se der erro 502/503:** Backend não está rodando

---

### Teste 2: Endpoint Webhook Existe?

```bash
curl https://chatsapi.nobreluminarias.com.br/webhooks/whatsapp
```

**Esperado:**
```
Cannot GET /webhooks/whatsapp
```
ou
```
Method Not Allowed
```

**Se der 404:** Rota não existe (problema no código)

---

### Teste 3: Verificação do Webhook (Simular Meta)

```bash
curl -X GET "https://chatsapi.nobreluminarias.com.br/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=602536nblumi2025&hub.challenge=test123"
```

**Esperado:**
```
test123
```

✅ **Se retornar "test123"** → Webhook está funcionando!  
❌ **Se der erro** → Problema no backend

---

### Teste 4: Verificar se Backend Está Rodando

```bash
# SSH no servidor
ssh usuario@seu-servidor

# Verificar container backend
docker ps | grep whaticketback

# Ver logs
docker service logs nobreluminarias_whaticketback --tail 50

# Verificar variáveis
docker exec $(docker ps -q -f name=whaticketback) env | grep WABA
```

**Esperado:**
```
WABA_WEBHOOK_VERIFY_TOKEN=602536nblumi2025
WABA_API_VERSION=v18.0
```

---

## 🔧 Solução Passo a Passo

### Passo 1: Testar Backend (No seu computador ou SSH)

```bash
# Teste simples
curl https://chatsapi.nobreluminarias.com.br

# Teste webhook
curl https://chatsapi.nobreluminarias.com.br/webhooks/whatsapp
```

---

### Passo 2: Se Backend Não Responder

```bash
# SSH no servidor
ssh usuario@seu-servidor

# Ver se container está rodando
docker ps -a | grep whaticketback

# Se não estiver, ver logs
docker service logs nobreluminarias_whaticketback

# Restart forçado
docker service update --force nobreluminarias_whaticketback
```

---

### Passo 3: Verificar Logs do Backend

```bash
docker service logs nobreluminarias_whaticketback -f
```

**Procurar por:**
- ✅ "Server started on port 8080"
- ✅ "Connected to database"
- ❌ Erros de TypeScript
- ❌ Erros de conexão

---

### Passo 4: Testar Verificação Manual

Use este comando para simular o que a Meta faz:

```bash
curl -v -X GET "https://chatsapi.nobreluminarias.com.br/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=602536nblumi2025&hub.challenge=TESTE123"
```

**Resposta esperada:**
```
< HTTP/2 200
< content-type: text/plain
TESTE123
```

Se retornar `TESTE123`, o webhook está funcionando!

---

## 📝 Configuração Correta na Meta

### 1. Meta Business Manager

```
https://business.facebook.com
```

### 2. WhatsApp → Configuration → Webhooks

**Callback URL:** (COPIE EXATAMENTE)
```
https://chatsapi.nobreluminarias.com.br/webhooks/whatsapp
```

**Verify Token:** (COPIE EXATAMENTE)
```
602536nblumi2025
```

### 3. Clicar "Verify and save"

✅ Deve funcionar agora!

---

## 🐛 Possíveis Problemas e Soluções

### Problema 1: Backend Não Responde

**Sintomas:**
- curl retorna 502/503
- "connection refused"

**Solução:**
```bash
# Verificar se está rodando
docker ps | grep whaticketback

# Restart
docker service update --force nobreluminarias_whaticketback

# Ver logs
docker service logs nobreluminarias_whaticketback
```

---

### Problema 2: 404 Not Found

**Sintomas:**
- curl retorna 404
- "Cannot GET /webhooks/whatsapp"

**Solução:**
- Verificar se fez build do backend com novo código
- Verificar se imagem Docker foi atualizada
- Verificar logs: procurar "webhook routes loaded"

---

### Problema 3: Verify Token Incorreto

**Sintomas:**
- Meta retorna "verify token mismatch"
- curl com token errado retorna erro

**Solução:**
```bash
# Verificar variável no container
docker exec $(docker ps -q -f name=whaticketback) env | grep WABA_WEBHOOK_VERIFY_TOKEN

# Deve retornar:
# WABA_WEBHOOK_VERIFY_TOKEN=602536nblumi2025
```

Se não aparecer, a variável não está configurada!

---

### Problema 4: HTTPS/SSL

**Sintomas:**
- Meta não consegue acessar
- "SSL handshake failed"

**Solução:**
- Verificar certificado SSL
- Testar: `curl -I https://chatsapi.nobreluminarias.com.br`
- Renovar certificado se expirado

---

## 🔍 Checklist de Diagnóstico

Execute na ordem:

- [ ] **Teste 1:** `curl https://chatsapi.nobreluminarias.com.br` → Retorna 200?
- [ ] **Teste 2:** `curl https://chatsapi.nobreluminarias.com.br/webhooks/whatsapp` → Não retorna 404?
- [ ] **Teste 3:** Teste com hub.challenge → Retorna o challenge?
- [ ] **Teste 4:** Variável WABA_WEBHOOK_VERIFY_TOKEN existe?
- [ ] **Teste 5:** Container backend está rodando?
- [ ] **Teste 6:** Logs do backend sem erros?
- [ ] **Teste 7:** URL na Meta usa chatsapi (não chats)?
- [ ] **Teste 8:** Verify token na Meta é exatamente: 602536nblumi2025?

---

## ✅ Teste Rápido (Copie e Cole)

```bash
echo "=== TESTE 1: Backend acessível? ==="
curl -I https://chatsapi.nobreluminarias.com.br

echo ""
echo "=== TESTE 2: Endpoint webhook existe? ==="
curl https://chatsapi.nobreluminarias.com.br/webhooks/whatsapp

echo ""
echo "=== TESTE 3: Verificação funciona? ==="
curl "https://chatsapi.nobreluminarias.com.br/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=602536nblumi2025&hub.challenge=FUNCIONOU"

echo ""
echo "Se retornar FUNCIONOU, está OK!"
```

---

## 🎯 Solução Mais Provável

**99% de chance:** Você está usando a URL do FRONTEND em vez do BACKEND.

**Solução:**
1. Ir na Meta
2. Mudar URL de `chats.` para `chatsapi.`
3. Tentar verificar novamente

**URL Correta:**
```
https://chatsapi.nobreluminarias.com.br/webhooks/whatsapp
```

---

## 📞 Se Nada Funcionar

### Debug Avançado

1. **Ver exatamente o que a Meta está enviando:**

```bash
# Adicionar log temporário no backend
# Em WhatsAppWebhookController.ts, método de verificação
console.log('Webhook verification:', req.query);
```

2. **Reiniciar e tentar configurar:**

```bash
docker service update --force nobreluminarias_whaticketback
# Aguardar 30s
# Tentar configurar na Meta
# Ver logs em tempo real:
docker service logs nobreluminarias_whaticketback -f
```

3. **Se ainda não funcionar:**
   - Verificar se migration foi executada
   - Verificar se código foi buildado
   - Verificar se imagem Docker está atualizada

---

## 🚀 Próximos Passos

1. **Executar testes acima**
2. **Corrigir URL na Meta** (usar chatsapi)
3. **Tentar verificar novamente**
4. **Se funcionar:** Subscribe aos eventos
5. **Criar conexão no Whaticket**
6. **Testar envio/recebimento**

---

*Documento criado em: 17/11/2024 às 11:45*  
*Status: Diagnóstico completo*  
*Solução mais provável: URL incorreta (frontend vs backend)*
