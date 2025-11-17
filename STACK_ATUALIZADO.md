# ✅ Stack Portainer Atualizado!

## 📝 Arquivo Atualizado

**Arquivo:** `frontend/stack.portainer.yml`

---

## 🔧 Mudanças Aplicadas

### Variáveis Adicionadas no Serviço `whaticketback`

```yaml
# WhatsApp Business API (Meta) - Configurações Globais
WABA_WEBHOOK_VERIFY_TOKEN: 602536nblumi2025
WABA_API_VERSION: v18.0
```

**Localização:** Após as configurações de validação de contatos (linha ~114)

---

## 🚀 Como Aplicar no Portainer

### Opção 1: Copiar e Colar (Mais Fácil)

1. **Acessar Portainer**
   ```
   https://seu-portainer.com
   ```

2. **Ir para Stacks**
   - Stacks → Sua stack
   - Clicar em **"Editor"**

3. **Localizar a Seção**
   
   Procure por estas linhas:
   ```yaml
   CONTACT_FILTER_INSERT_CHUNK_SIZE: "1000"
   ```

4. **Adicionar Logo Abaixo**
   ```yaml
   # WhatsApp Business API (Meta) - Configurações Globais
   WABA_WEBHOOK_VERIFY_TOKEN: 602536nblumi2025
   WABA_API_VERSION: v18.0
   ```

5. **Update Stack**
   - Clicar em **"Update the stack"**
   - ✅ Marcar: "Re-pull image and redeploy"
   - Clicar em **"Update"**

---

### Opção 2: Substituir o Arquivo Completo

1. **Copiar o arquivo local para o servidor**
   ```bash
   scp C:\Users\feliperosa\whaticket\frontend\stack.portainer.yml usuario@servidor:/caminho/
   ```

2. **No Portainer:**
   - Delete a stack antiga
   - Crie nova stack do arquivo

---

## 🧪 Verificar Após Deploy

### 1. Ver Logs do Backend
```bash
docker service logs nobreluminarias_whaticketback -f
```

### 2. Verificar Variáveis
```bash
docker exec $(docker ps -q -f name=whaticketback) env | grep WABA
```

**Esperado:**
```
WABA_WEBHOOK_VERIFY_TOKEN=602536nblumi2025
WABA_API_VERSION=v18.0
```

### 3. Testar Webhook
```bash
curl -X GET "https://taktchat-api.alivesolucoes.com.br/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=602536nblumi2025&hub.challenge=test123"
```

**Esperado:** Retornar `test123`

---

## 🎯 Configurar na Meta

Após aplicar as mudanças e reiniciar:

1. **Meta Business Manager**
   ```
   https://business.facebook.com
   ```

2. **WhatsApp → Configuration → Webhooks**

3. **Preencher:**
   - **Callback URL:** `https://taktchat-api.alivesolucoes.com.br/webhooks/whatsapp`
   - **Verify Token:** `602536nblumi2025`

4. **Clicar "Verify and Save"**

✅ **Deve aparecer:** "Webhook verified successfully"

5. **Subscribe aos Eventos:**
   - ✅ `messages`
   - ✅ `message_status`

---

## 📊 Estrutura Final das Variáveis

### No Stack Portainer (whaticketback service)

```yaml
environment:
  # ... outras variáveis ...
  
  # Validação WhatsApp
  CONTACT_FILTER_ASYNC_VALIDATION: "false"
  CONTACT_FILTER_VALIDATION_BATCH_SIZE: "50"
  CONTACT_FILTER_DIRECT_SQL: "false"
  CONTACT_FILTER_VALIDATE_WHATSAPP: "true"
  CONTACT_FILTER_INSERT_CHUNK_SIZE: "1000"
  
  # WhatsApp Business API (Meta) - NOVO!
  WABA_WEBHOOK_VERIFY_TOKEN: 602536nblumi2025
  WABA_API_VERSION: v18.0
```

---

## ⚠️ Importante

### URLs Corretas

Verifique se estas variáveis estão com seus domínios reais:

```yaml
FRONTEND_URL: https://taktchat.alivesolucoes.com.br
BACKEND_URL: https://taktchat-api.alivesolucoes.com.br
REACT_APP_BACKEND_URL: https://taktchat-api.alivesolucoes.com.br
```

### Traefik Labels

Certifique-se que o Traefik está configurado para:

```yaml
traefik.http.routers.whaticketback.rule: Host(`taktchat-api.alivesolucoes.com.br`)
traefik.http.routers.whaticketback.entrypoints: websecure
traefik.http.routers.whaticketback.tls.certresolver: letsencryptresolver
```

---

## ✅ Checklist Pré-Deploy

- [x] ✅ Variáveis WABA adicionadas ao stack
- [x] ✅ BACKEND_URL usa domínio real (não localhost)
- [ ] Stack atualizada no Portainer
- [ ] Serviços reiniciados
- [ ] Logs verificados
- [ ] Variáveis confirmadas (docker exec)
- [ ] Webhook testado (curl)
- [ ] Configurado na Meta
- [ ] Webhook verificado com sucesso
- [ ] Eventos subscritos

---

## 🎯 Próximos Passos

1. **Aplicar no Portainer**
   - Copiar variáveis para o editor
   - Update stack
   - Aguardar restart (~1-2 min)

2. **Verificar**
   - Logs sem erros
   - Variáveis presentes
   - Webhook acessível

3. **Configurar Meta**
   - Callback URL
   - Verify Token
   - Subscribe eventos

4. **Testar**
   - Criar conexão API Oficial
   - Enviar mensagem
   - Receber mensagem

---

## 🔧 Comandos Úteis

### Ver Logs em Tempo Real
```bash
docker service logs nobreluminarias_whaticketback -f --tail 100
```

### Restart Serviço
```bash
docker service update --force nobreluminarias_whaticketback
```

### Verificar Status
```bash
docker service ps nobreluminarias_whaticketback
```

### Ver Variáveis de Ambiente
```bash
docker exec $(docker ps -q -f name=whaticketback) env | grep -E "WABA|BACKEND_URL"
```

---

## 📝 Resumo

**Arquivo atualizado:** ✅  
**Variáveis adicionadas:** ✅  
- `WABA_WEBHOOK_VERIFY_TOKEN: 602536nblumi2025`
- `WABA_API_VERSION: v18.0`

**Próximo passo:** Aplicar no Portainer e configurar na Meta!

---

*Arquivo atualizado em: 17/11/2024 às 03:27*  
*Status: ✅ Pronto para deploy*  
*Stack: frontend/stack.portainer.yml*
