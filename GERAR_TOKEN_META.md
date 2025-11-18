# 🔑 Como Gerar Novo Access Token da Meta

## 🚨 Problema: Token Expirado

```
Error validating access token: Session has expired
```

---

## ✅ Solução: Gerar Novo Token

### Opção 1: Token Temporário (60 dias) - Teste

#### Passo 1: Acessar Graph API Explorer
```
https://developers.facebook.com/tools/explorer/
```

#### Passo 2: Configurar
1. Selecionar **App** → Seu app WhatsApp
2. Selecionar **User Token** → Fazer login
3. Selecionar **Permissions**:
   - ✅ `whatsapp_business_management`
   - ✅ `whatsapp_business_messaging`
   - ✅ `business_management`

#### Passo 3: Gerar Token
1. Clicar em **Generate Access Token**
2. Fazer login com sua conta Facebook
3. Autorizar permissões
4. **Copiar** o token gerado

#### Passo 4: Converter para Long-Lived (60 dias)
```
GET https://graph.facebook.com/v18.0/oauth/access_token?
  grant_type=fb_exchange_token&
  client_id={APP_ID}&
  client_secret={APP_SECRET}&
  fb_exchange_token={SHORT_LIVED_TOKEN}
```

**Exemplo:**
```bash
curl "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=123456789&client_secret=abc123&fb_exchange_token=EAAxxxx"
```

**Resposta:**
```json
{
  "access_token": "EAALwr4pIHMc...", // ← Novo token (60 dias)
  "token_type": "bearer",
  "expires_in": 5183999 // segundos (60 dias)
}
```

---

### ⭐ Opção 2: Token Permanente (Produção) - RECOMENDADO

#### Passo 1: Criar System User

1. **Acessar Business Manager:**
   ```
   https://business.facebook.com/settings/system-users
   ```

2. **Criar System User:**
   - Clicar em **Add** → **Create System User**
   - Nome: "WhatsApp API Production"
   - Role: **Admin**

3. **Adicionar Assets:**
   - WhatsApp Business Account
   - App WhatsApp
   - Permissões necessárias

#### Passo 2: Gerar Token Permanente

1. **No System User criado:**
   - Clicar em **Generate New Token**
   
2. **Selecionar App:**
   - Escolher seu App WhatsApp
   
3. **Selecionar Permissões:**
   - ✅ `whatsapp_business_management`
   - ✅ `whatsapp_business_messaging`
   - ✅ `business_management`
   
4. **Configurar Duração:**
   - **Never Expire** ✅ (Token permanente)
   
5. **Copiar Token:**
   - Copiar e guardar em local seguro
   - **ATENÇÃO:** Será exibido apenas uma vez!

---

## 🔧 Como Atualizar no Sistema

### Opção A: Via Interface (Recomendado)

```
1. Admin → Conexões
2. Selecionar conexão "API-oficial"
3. Editar
4. Atualizar campo "Access Token"
5. Colar novo token
6. Salvar
7. Reiniciar Conexão
```

### Opção B: Via Banco de Dados

```sql
-- Verificar conexões API Oficial
SELECT id, name, channelType, status 
FROM "Whatsapps" 
WHERE "channelType" = 'official';

-- Atualizar token
UPDATE "Whatsapps" 
SET "wabaAccessToken" = 'SEU_NOVO_TOKEN_AQUI'
WHERE id = 7; -- ou 8, conforme o ID da sua conexão

-- Verificar atualização
SELECT id, name, 
  LEFT("wabaAccessToken", 20) || '...' as token_preview,
  status
FROM "Whatsapps" 
WHERE id = 7;
```

---

## 🔍 Verificar Validade do Token

### Teste 1: Endpoint de Debug

```bash
curl "https://graph.facebook.com/v18.0/debug_token?input_token=SEU_TOKEN&access_token=SEU_TOKEN"
```

**Resposta:**
```json
{
  "data": {
    "app_id": "123456789",
    "type": "USER",
    "application": "App WhatsApp",
    "data_access_expires_at": 1734480000,
    "expires_at": 1739750400, // ← Data de expiração
    "is_valid": true,
    "scopes": [
      "whatsapp_business_management",
      "whatsapp_business_messaging"
    ],
    "user_id": "987654321"
  }
}
```

### Teste 2: Buscar WABA

```bash
curl -X GET "https://graph.facebook.com/v18.0/SEU_WABA_ID?access_token=SEU_TOKEN"
```

**Se funcionar:**
```json
{
  "id": "372333099299804",
  "name": "Minha Empresa",
  "timezone_id": "12",
  "message_template_namespace": "abc123_xyz"
}
```

**Se expirado:**
```json
{
  "error": {
    "message": "Error validating access token: Session has expired",
    "type": "OAuthException",
    "code": 190
  }
}
```

---

## 🎯 Identificar Informações Necessárias

### App ID e App Secret

```
1. https://developers.facebook.com/apps/
2. Selecionar seu app
3. Settings → Basic
4. App ID: xxxxx
5. App Secret: [Show] → Copiar
```

### WABA ID (WhatsApp Business Account)

```
1. https://business.facebook.com/wa/manage/home/
2. Settings → API Setup
3. Business Account ID: xxxxx
```

### Phone Number ID

```
1. https://business.facebook.com/wa/manage/phone-numbers/
2. Selecionar número
3. Phone Number ID: xxxxx
```

---

## 📊 Comparação de Tokens

| Aspecto | Short-lived | Long-lived | System User |
|---------|-------------|------------|-------------|
| **Duração** | 1 hora | 60 dias | Permanente |
| **Renovação** | Sempre | A cada 60 dias | Não precisa |
| **Uso** | Teste | Desenvolvimento | Produção ✅ |
| **Segurança** | Baixa | Média | Alta |
| **Recomendado** | ❌ Não | ⚠️ Dev | ✅ Prod |

---

## 🔄 Workflow Completo

```
1. Gerar novo token (permanente)
   ↓
2. Atualizar no banco ou interface
   ↓
3. Admin → Conexões → Reiniciar
   ↓
4. Ver logs:
   [OfficialAPI] Inicializando... ✅
   [StartSession] Official API conectada ✅
   ↓
5. Status: "CONNECTED" ✅
```

---

## 🚨 Troubleshooting

### Erro: "Invalid OAuth access token"
```
❌ Token inválido ou expirado
✅ Gerar novo token
```

### Erro: "Permissions error"
```
❌ Token sem permissões necessárias
✅ Regenerar com permissões corretas:
   - whatsapp_business_management
   - whatsapp_business_messaging
```

### Erro: "App not subscribed to this WABA"
```
❌ App não está vinculado ao WABA
✅ Business Manager → Apps → Adicionar App ao WABA
```

---

## 📋 Checklist de Segurança

- [ ] Token gerado via System User (produção)
- [ ] Permissões mínimas necessárias
- [ ] Token armazenado de forma segura
- [ ] Backup do token em local seguro
- [ ] Não compartilhar token publicamente
- [ ] Não commitar token no Git
- [ ] Usar variáveis de ambiente (.env)

---

## 🔗 Links Úteis

### Gerar Tokens:
- **Graph API Explorer:** https://developers.facebook.com/tools/explorer/
- **System Users:** https://business.facebook.com/settings/system-users
- **Debug Token:** https://developers.facebook.com/tools/debug/accesstoken/

### Documentação:
- **Access Tokens:** https://developers.facebook.com/docs/facebook-login/guides/access-tokens
- **System Users:** https://developers.facebook.com/docs/development/create-an-app/app-dashboard/system-users
- **WhatsApp API:** https://developers.facebook.com/docs/whatsapp/cloud-api/get-started

### Gerenciar:
- **Business Manager:** https://business.facebook.com/
- **Apps:** https://developers.facebook.com/apps/
- **WhatsApp Manager:** https://business.facebook.com/wa/manage/home/

---

## 💡 Dicas Importantes

### 1. Token Permanente vs Temporário
```
❌ Token de 60 dias expira e quebra produção
✅ Token permanente (System User) não expira
```

### 2. Renovação Automática
```
Não existe renovação automática!
Solução: Usar token permanente de System User
```

### 3. Backup
```
Sempre guardar cópia do token em:
- Password manager (1Password, LastPass)
- Arquivo criptografado
- Variável de ambiente
```

### 4. Múltiplos Tokens
```
Você pode ter múltiplos tokens:
- 1 para desenvolvimento
- 1 para produção
- 1 para cada ambiente
```

---

## 🎯 Resumo Executivo

**Problema:**
- Access Token expirou
- API Oficial não conecta

**Solução Rápida (60 dias):**
1. https://developers.facebook.com/tools/explorer/
2. Gerar token → Converter para long-lived
3. Atualizar no sistema

**Solução Permanente (Recomendada):**
1. https://business.facebook.com/settings/system-users
2. Criar System User
3. Gerar token permanente
4. Atualizar no sistema

**Resultado:**
- ✅ Token válido
- ✅ API conectada
- ✅ Sem necessidade de renovação

---

**IMPORTANTE:** Para produção, SEMPRE use token de System User com duração "Never Expire"!
