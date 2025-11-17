# 📘 Tutorial Completo - Integração WhatsApp Business API Meta

## 🎯 Objetivo

Integrar o WhatsApp Business API Oficial da Meta no seu Whaticket, permitindo enviar e receber mensagens profissionais com suporte oficial.

**Tempo estimado:** 30-45 minutos

---

## 📋 Pré-requisitos

### O Que Você Precisa Ter

✅ **Conta no Facebook Business**
- Acesso: https://business.facebook.com
- Se não tem, clicar em "Criar Conta"

✅ **Número de Telefone Dedicado**
- Não pode estar no WhatsApp pessoal
- Não pode estar em outro WhatsApp Business
- Chip funcionando e ativo

✅ **Whaticket Acessível na Internet**
- Domínio ou IP público
- **HTTPS obrigatório** (webhook Meta exige)
- Backend rodando e acessível

✅ **Documentos da Empresa** (para verificação)
- CNPJ ou CPF
- Comprovante de endereço
- Identidade do responsável

---

## 📖 Parte 1: Criar Conta Meta Business

### Passo 1: Acessar Meta Business Manager

1. Abra: https://business.facebook.com
2. Clique em **"Criar Conta"** (se não tem)
3. Preencha:
   - Nome da empresa
   - Seu nome
   - Email de trabalho
4. Clique em **"Avançar"**

### Passo 2: Verificar Email

1. Abra seu email
2. Clique no link de verificação
3. Volte para o Meta Business Manager

### Passo 3: Adicionar Informações da Empresa

1. Nome da empresa
2. Endereço completo
3. Telefone de contato
4. Site (se tiver)
5. Clique em **"Enviar"**

---

## 📖 Parte 2: Configurar WhatsApp Business API

### Passo 1: Adicionar WhatsApp ao Business

1. No Meta Business Manager, clique em **"Adicionar ativos"**
2. Selecione **"WhatsApp"**
3. Clique em **"Começar"**

### Passo 2: Escolher Tipo de Conta

**Opção 1: Conta Nova**
- Criar novo número WhatsApp
- Mais rápido (recomendado para teste)

**Opção 2: Migrar Conta Existente**
- Migrar WhatsApp Business existente
- Requer verificação adicional

### Passo 3: Registrar Número de Telefone

1. Digite o número: `+55 11 99999-9999`
2. Escolha método de verificação:
   - SMS (mais rápido)
   - Ligação de voz
3. Digite o código recebido
4. Clique em **"Verificar"**

### Passo 4: Completar Perfil

1. **Nome de exibição:** Nome que aparecerá para clientes
2. **Categoria:** Escolha categoria do negócio
3. **Descrição:** Breve descrição (opcional)
4. **Foto de perfil:** Logo da empresa
5. Clique em **"Salvar"**

---

## 📖 Parte 3: Obter Credenciais da API

### Passo 1: Acessar Configurações do WhatsApp

1. No Meta Business Manager
2. Menu lateral → **"WhatsApp"**
3. Clique em **"Configuration"** (ou "Configuração")

### Passo 2: Anotar Phone Number ID

1. Na seção **"Phone numbers"**
2. Você verá algo como: `123456789012345`
3. **Copie este número** → será o `Phone Number ID`

```
Phone Number ID: 123456789012345
```

### Passo 3: Anotar Business Account ID

1. Ainda em Configuration
2. Procure por **"WhatsApp Business Account ID"**
3. Algo como: `987654321098765`
4. **Copie este número** → será o `Business Account ID`

```
Business Account ID: 987654321098765
```

### Passo 4: Criar Access Token

1. Clique em **"System Users"** (Usuários do Sistema)
2. Clique em **"Add"** → "Add System User"
3. Nome: `Whaticket Integration`
4. Função: **Admin**
5. Clique em **"Create System User"**

6. Na lista de System Users, clique no nome criado
7. Clique em **"Generate New Token"**
8. Selecione o WhatsApp Business Account
9. Permissões:
   - ✅ `whatsapp_business_messaging`
   - ✅ `whatsapp_business_management`
10. Duração: **60 dias** (máximo)
11. Clique em **"Generate Token"**

12. **⚠️ IMPORTANTE:** Copie o token AGORA!
    - Só aparece uma vez
    - Algo como: `EAAxxxxxxxxxxxxxxxxxxxxxxxx`
    - Se perder, precisa gerar novo

```
Access Token: EAAxxxxxxxxxxxxxxxxxxxxxxxx
```

### Passo 5: Criar Webhook Verify Token

Este você cria! É um valor secreto único.

**Exemplo seguro:**
```
minha_empresa_whatsapp_2024_xyz789
```

**Dicas:**
- Mínimo 20 caracteres
- Letras, números, underscores
- Sem espaços
- Único para sua aplicação

```
Webhook Verify Token: minha_empresa_whatsapp_2024_xyz789
```

---

## 📖 Parte 4: Configurar no Whaticket

### Passo 1: Acessar Whaticket

1. Abra seu Whaticket: `https://seudominio.com`
2. Faça login como administrador

### Passo 2: Criar Nova Conexão

1. Menu → **"Conexões"**
2. Clique em **"Nova Conexão"**
3. Escolha **"WhatsApp"**

### Passo 3: Preencher Dados Básicos

1. **Nome da Conexão:** "WhatsApp Vendas" (ou qualquer nome)
2. **Tipo de Canal:** Selecione **"WhatsApp Business API (Meta - Pago)"**

### Passo 4: Preencher Credenciais Meta

Cole os valores anotados anteriormente:

1. **Phone Number ID:**
   ```
   123456789012345
   ```

2. **Business Account ID:**
   ```
   987654321098765
   ```

3. **Access Token:**
   ```
   EAAxxxxxxxxxxxxxxxxxxxxxxxx
   ```

4. **Webhook Verify Token:**
   ```
   minha_empresa_whatsapp_2024_xyz789
   ```

### Passo 5: Copiar URLs do Webhook

Na tela, você verá dois valores importantes:

**1. Callback URL:**
- Clique no botão **"Copiar"** ao lado
- Será algo como: `https://seudominio.com/webhooks/whatsapp`

**2. Verify Token:**
- Clique no botão **"Copiar"** ao lado
- É o mesmo que você digitou acima

### Passo 6: Salvar Conexão

1. Revise todos os campos
2. Clique em **"Salvar"**
3. ✅ Conexão será criada!

---

## 📖 Parte 5: Configurar Webhook na Meta

### Passo 1: Voltar ao Meta Business Manager

1. Meta Business Manager → **"WhatsApp"**
2. Clique em **"Configuration"**
3. Procure seção **"Webhooks"**

### Passo 2: Editar Webhook

1. Clique em **"Edit"** (ou "Configure" se for primeira vez)

### Passo 3: Preencher Callback URL

1. **Callback URL:** Cole a URL copiada do Whaticket
   ```
   https://seudominio.com/webhooks/whatsapp
   ```

2. **Verify Token:** Cole o token copiado
   ```
   minha_empresa_whatsapp_2024_xyz789
   ```

3. Clique em **"Verify and Save"**

### Passo 4: Subscribe aos Eventos

Na seção **"Webhook Fields"**, ative:

✅ **messages** - Para receber mensagens
✅ **message_status** - Para receber status de entrega

Outros campos (opcional):
- ⬜ message_template_status_update
- ⬜ message_template_quality_update

### Passo 5: Testar Webhook

1. Meta vai enviar uma requisição para seu servidor
2. Se sucesso: ✅ "Webhook verified"
3. Se erro: ❌ Verifique:
   - Seu servidor está acessível?
   - HTTPS está funcionando?
   - Verify Token está correto?

---

## 📖 Parte 6: Testar Integração

### Teste 1: Enviar Mensagem

1. No Whaticket:
   - Menu → **"Atendimento"**
   - Clique em **"Novo Ticket"**
   - Digite número de teste: `5511988887777`
   - Digite mensagem: "Olá! Este é um teste."
   - Clique em **"Enviar"**

2. ✅ Esperado:
   - Mensagem aparece como enviada
   - Ack muda de 1 → 2 → 3
   - WhatsApp do destinatário recebe a mensagem

### Teste 2: Receber Mensagem

1. Do seu WhatsApp pessoal:
   - Envie mensagem para o número configurado
   - Exemplo: "Oi, quero informações"

2. ✅ Esperado:
   - Mensagem aparece no Whaticket
   - Ticket é criado automaticamente
   - Badge "API Oficial" aparece na lista de conexões

### Teste 3: Status de Entrega

1. Envie uma mensagem pelo Whaticket
2. Observe os ícones de ack:
   - ✓ (1 ack) = Enviada ao servidor Meta
   - ✓✓ (2 acks) = Entregue no WhatsApp do destinatário
   - ✓✓ azul (3 acks) = Lida pelo destinatário

---

## 🔧 Solução de Problemas

### Problema: "Webhook verification failed"

**Causas:**
- Servidor não acessível
- HTTPS não configurado
- Verify Token diferente

**Solução:**
```bash
# 1. Testar se servidor está acessível
curl https://seudominio.com/webhooks/whatsapp

# 2. Verificar logs do backend
cd backend
pm2 logs

# 3. Conferir Verify Token no .env
cat .env | grep WABA_WEBHOOK_VERIFY_TOKEN
```

### Problema: "Access Token inválido"

**Causas:**
- Token expirado (60 dias)
- Token copiado errado
- Permissões insuficientes

**Solução:**
1. Gerar novo token no Meta
2. Copiar completo (começa com `EAA`)
3. Atualizar no Whaticket
4. Salvar conexão novamente

### Problema: "Não recebo mensagens"

**Causas:**
- Webhook não subscrito aos eventos
- Firewall bloqueando Meta
- Servidor fora do ar

**Solução:**
1. Verificar eventos subscritos (messages, message_status)
2. Verificar logs do webhook:
```bash
tail -f backend/logs/webhook.log
```
3. Testar manualmente:
```bash
curl -X POST https://seudominio.com/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Problema: "Mensagens não são enviadas"

**Causas:**
- Phone Number ID errado
- Rate limit atingido
- Número não verificado

**Solução:**
1. Conferir Phone Number ID no Meta
2. Verificar quota de mensagens
3. Logs do backend:
```bash
cd backend
npm run dev
# Tentar enviar mensagem e ver logs
```

---

## 📊 Limites e Quotas

### Limites de Mensagens

| Tier | Mensagens/dia | Observação |
|------|---------------|------------|
| **Tier 1** | 1.000 | Conta nova |
| **Tier 2** | 10.000 | Após 7 dias de uso |
| **Tier 3** | 100.000 | Após 30 dias |
| **Tier 4** | Ilimitado | Aprovação Meta |

### Custos (Brasil)

| Tipo | Custo |
|------|-------|
| **Conversas de Serviço** | R$ 0,17 |
| **Conversas de Marketing** | R$ 0,34 |
| **Primeiras 1.000/mês** | Grátis |

**Conversa = Janela de 24h**

---

## ✅ Checklist Final

### Backend
- [ ] Servidor acessível na internet
- [ ] HTTPS configurado e funcionando
- [ ] Migration executada (`npm run migrate`)
- [ ] Backend rodando (`npm run dev` ou PM2)
- [ ] Portas liberadas no firewall

### Meta Business
- [ ] Conta criada e verificada
- [ ] WhatsApp Business API ativado
- [ ] Número verificado e ativo
- [ ] Phone Number ID anotado
- [ ] Business Account ID anotado
- [ ] Access Token gerado (válido 60 dias)
- [ ] System User criado com permissões
- [ ] Webhook configurado
- [ ] Eventos subscritos (messages, message_status)
- [ ] Webhook verificado com sucesso

### Whaticket
- [ ] Conexão criada
- [ ] Credenciais preenchidas corretamente
- [ ] Conexão salva com sucesso
- [ ] Badge "API Oficial" aparece na lista
- [ ] Status "CONNECTED"

### Testes
- [ ] Envio de mensagem funciona
- [ ] Recebimento de mensagem funciona
- [ ] Acks atualizam corretamente
- [ ] Ticket criado automaticamente
- [ ] Webhook recebendo eventos

---

## 🎓 Dicas Profissionais

### 1. Renovação de Token

Access Token expira em 60 dias. Configure lembrete:

```bash
# Adicionar no crontab para avisar 7 dias antes
0 9 * * * echo "Renovar Access Token do WhatsApp!" | mail -s "WhatsApp Token" admin@empresa.com
```

### 2. Monitoramento

Configure monitoramento do webhook:

```javascript
// backend/src/controllers/WhatsAppWebhookController.ts
logger.info(`Webhook recebido: ${JSON.stringify(req.body)}`);
```

### 3. Backup das Credenciais

Salve as credenciais em local seguro:

```bash
# .env.backup (não versionar!)
WABA_PHONE_NUMBER_ID=123456789012345
WABA_BUSINESS_ACCOUNT_ID=987654321098765
WABA_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxx
WABA_WEBHOOK_VERIFY_TOKEN=minha_empresa_whatsapp_2024_xyz789
```

### 4. Templates Aprovados

Para enviar mensagens proativas (fora da janela de 24h), use templates:

1. Meta Business → WhatsApp → Message Templates
2. Criar template
3. Aguardar aprovação (24-48h)
4. Usar no Whaticket

### 5. Múltiplos Números

Para múltiplas conexões:
- Repita o processo para cada número
- Cada número = uma conexão no Whaticket
- Mesmo Business Account pode ter vários números

---

## 📚 Links Úteis

| Recurso | URL |
|---------|-----|
| **Meta Business Manager** | https://business.facebook.com |
| **Documentação Oficial** | https://developers.facebook.com/docs/whatsapp |
| **Get Started Guide** | https://developers.facebook.com/docs/whatsapp/cloud-api/get-started |
| **API Reference** | https://developers.facebook.com/docs/whatsapp/cloud-api/reference |
| **Suporte Meta** | https://business.facebook.com/business/help |
| **Preços** | https://developers.facebook.com/docs/whatsapp/pricing |

---

## 🎯 Próximos Passos

Após configuração bem-sucedida:

1. **Treinar equipe** - Ensinar uso da plataforma
2. **Criar templates** - Mensagens proativas aprovadas
3. **Configurar filas** - Organizar atendimento
4. **Definir horários** - Horário de funcionamento
5. **Monitorar custos** - Acompanhar uso mensal
6. **Renovar token** - Lembrar 60 dias

---

## ✅ Conclusão

**Parabéns!** 🎉

Você configurou com sucesso a integração do WhatsApp Business API Oficial!

**Benefícios agora disponíveis:**
- ✅ Envio e recebimento profissional
- ✅ Suporte oficial da Meta
- ✅ Escalabilidade garantida
- ✅ Templates aprovados
- ✅ Métricas oficiais
- ✅ Menos risco de banimento

**Dúvidas?**
- Consulte a documentação
- Verifique os logs
- Entre em contato com suporte

---

*Tutorial criado em: 17/11/2024*  
*Versão: 1.0*  
*Tempo médio de configuração: 30-45 minutos*
