# ⚡ Quick Start: WhatsApp API Oficial

## 🎯 Configuração Rápida (30 minutos)

### 1️⃣ Obter Credenciais Meta (10 min)

**Acesse:** https://business.facebook.com/

1. **Criar/Acessar Meta Business Account**
2. **Adicionar WhatsApp Business**
   - Settings → WhatsApp Accounts → Add
3. **Copiar Credenciais:**
   ```
   Phone Number ID: 1234567890
   Access Token: EAAxxxxxxxxxxxx
   Business Account ID: 9876543210
   ```

### 2️⃣ Configurar Webhook (5 min)

1. **No Meta Business:**
   - Configuration → Webhooks
   - Callback URL: `https://seu-dominio.com/webhooks/whatsapp`
   - Verify Token: `meu_token_secreto_123`
   - Subscribe: messages, message_status

2. **No seu servidor:**
   ```bash
   # Verificar se URL pública está acessível
   curl https://seu-dominio.com/health
   ```

### 3️⃣ Instalar Dependências (2 min)

```bash
cd backend
npm install axios dotenv
```

### 4️⃣ Configurar .env (3 min)

```env
# WhatsApp Official API
WABA_PHONE_NUMBER_ID=1234567890
WABA_ACCESS_TOKEN=EAAxxxxxxxxxxxx
WABA_BUSINESS_ACCOUNT_ID=9876543210
WABA_WEBHOOK_VERIFY_TOKEN=meu_token_secreto_123
```

### 5️⃣ Criar Migration (5 min)

```bash
cd backend

# Criar arquivo de migration
npm run sequelize migration:create -- --name add-whatsapp-official-api-fields

# Copiar código do WHATSAPP_API_OFICIAL_PLANO.md (FASE 1.2)
# Editar o arquivo criado em src/database/migrations/

# Executar migration
npm run build
npm run db:migrate
```

### 6️⃣ Teste Rápido (5 min)

**Criar arquivo de teste:**

```typescript
// backend/test-official-api.ts
import axios from 'axios';

const phoneNumberId = process.env.WABA_PHONE_NUMBER_ID;
const accessToken = process.env.WABA_ACCESS_TOKEN;
const testNumber = '5511999999999'; // SEU NÚMERO

async function testSend() {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: testNumber,
        type: 'text',
        text: { body: '✅ WhatsApp API Oficial funcionando!' }
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Mensagem enviada!', response.data);
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

testSend();
```

**Executar:**
```bash
npx ts-node backend/test-official-api.ts
```

---

## 🔥 Teste de Integração Completa

### Cenário 1: Enviar Mensagem de Texto

```typescript
// No Postman ou Insomnia
POST https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages

Headers:
  Authorization: Bearer {ACCESS_TOKEN}
  Content-Type: application/json

Body:
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "text",
  "text": {
    "body": "Olá do WhatsApp API Oficial! 🚀"
  }
}
```

### Cenário 2: Enviar Mensagem com Botões

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "interactive",
  "interactive": {
    "type": "button",
    "body": {
      "text": "Escolha uma opção:"
    },
    "action": {
      "buttons": [
        {
          "type": "reply",
          "reply": {
            "id": "btn_1",
            "title": "Opção 1"
          }
        },
        {
          "type": "reply",
          "reply": {
            "id": "btn_2",
            "title": "Opção 2"
          }
        }
      ]
    }
  }
}
```

### Cenário 3: Enviar Imagem

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "image",
  "image": {
    "link": "https://exemplo.com/imagem.jpg",
    "caption": "Legenda da imagem"
  }
}
```

---

## 🔧 Troubleshooting Rápido

### Erro: "Phone number not verified"
**Solução:** Verificar número no Meta Business Manager

### Erro: "Invalid access token"
**Solução:** Renovar token no App Dashboard

### Erro: "Webhook verification failed"
**Solução:** Verificar WABA_WEBHOOK_VERIFY_TOKEN no .env

### Erro: "Message not delivered"
**Solução:** Número destinatário tem WhatsApp? Está no formato correto?

---

## 📊 Comparativo: Baileys vs API Oficial

| Recurso | Baileys | API Oficial |
|---------|---------|-------------|
| **Autenticação** | QR Code | Access Token |
| **Custo** | Gratuito | Pago (R$ 0,17-0,34/conversa) |
| **Confiabilidade** | Moderada | Alta (SLA Meta) |
| **Banimento** | Risco | Sem risco |
| **Escalabilidade** | Limitada | Ilimitada |
| **Templates** | Não | Sim |
| **Botões/Listas** | Limitado | Completo |
| **Multi-agente** | Não recomendado | Nativo |
| **Webhooks** | Não | Sim |
| **Analytics** | Não | Sim |

---

## 🎯 Próximos Passos Recomendados

### Semana 1
- [ ] Configurar conta Meta Business
- [ ] Obter credenciais
- [ ] Executar teste rápido acima
- [ ] Criar migration

### Semana 2
- [ ] Implementar adapters (BaileysAdapter + OfficialAPIAdapter)
- [ ] Criar factory pattern
- [ ] Testes unitários

### Semana 3
- [ ] Implementar webhooks
- [ ] Adaptar services existentes
- [ ] Testes de integração

### Semana 4
- [ ] Interface frontend
- [ ] Testes em produção
- [ ] Documentação final

---

## 💡 Dicas Importantes

### Custos
- ✅ **Primeiras 1.000 conversas/mês**: GRATUITAS
- 💰 **Após 1.000**: R$ 0,17 (serviço) ou R$ 0,34 (marketing)
- 📊 **Conversa**: Janela de 24h após primeira mensagem

### Limites
- ⏱️ **Rate limit**: 80 mensagens/segundo
- 📱 **Tier inicial**: 250 conversas únicas/dia
- 🚀 **Tier máximo**: Ilimitado (após aprovação)

### Boas Práticas
- ✅ Sempre validar número antes de enviar
- ✅ Usar templates para mensagens de marketing
- ✅ Implementar retry logic para falhas
- ✅ Monitorar webhooks com logs detalhados
- ✅ Cachear tokens (válidos por 60 dias)

---

## 📞 Suporte e Recursos

### Documentação Oficial
- **Meta Developers**: https://developers.facebook.com/docs/whatsapp
- **API Reference**: https://developers.facebook.com/docs/whatsapp/cloud-api/reference
- **Webhooks**: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks

### Comunidade
- **WhatsApp Business Developers**: https://www.facebook.com/groups/whatsappbusiness
- **Stack Overflow**: Tag `whatsapp-business-api`

### Status da API
- **Status Page**: https://developers.facebook.com/status

---

## ✅ Checklist de Validação

Antes de ir para produção, verificar:

- [ ] Credenciais Meta configuradas corretamente
- [ ] Webhook responde com 200 OK
- [ ] Migration executada sem erros
- [ ] Teste de envio funcionando
- [ ] Teste de recebimento funcionando
- [ ] Logs configurados
- [ ] Monitoramento ativo
- [ ] Documentação atualizada
- [ ] Backup do banco de dados
- [ ] Rollback plan definido

---

**Tempo estimado total:** 30 minutos + desenvolvimento incremental

**Pronto para começar!** 🚀
