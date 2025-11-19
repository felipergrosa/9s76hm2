# 📱 Integração Facebook & Instagram - Guia Completo

## ✅ SISTEMA JÁ ESTÁ PREPARADO!

Ótima notícia! O **Whaticket já possui integração completa** com Facebook Messenger e Instagram Direct! 🎉


## 🎯 O Que Você Pode Fazer

### Facebook Messenger 💬
- ✅ Receber mensagens da sua Página do Facebook
- ✅ Responder mensagens
- ✅ Enviar mídias (fotos, vídeos, documentos)
- ✅ Criar tickets automaticamente
- ✅ Usar chatbot/flowbuilder
- ✅ Atribuir para atendentes
- ✅ Todas as funcionalidades do Whaticket!

### Instagram Direct 📸
- ✅ Receber mensagens do Instagram
- ✅ Responder DMs
- ✅ Enviar mídias
- ✅ Criar tickets automaticamente
- ✅ Usar chatbot/flowbuilder
- ✅ Atribuir para atendentes
- ✅ Todas as funcionalidades do Whaticket!

---

## 📋 Pré-requisitos

### 1️⃣ Conta Meta for Developers
- Criar conta em: https://developers.facebook.com/

### 2️⃣ Página do Facebook
- Ter uma Página do Facebook criada
- Ser administrador da página

### 3️⃣ Conta Instagram Business (para Instagram)
- Conta do Instagram vinculada à Página do Facebook
- Convertida para perfil profissional/empresarial

### 4️⃣ App Facebook
- Criar um App no Meta for Developers
- Adicionar produtos: Messenger, Instagram

---

## 🔧 PASSO A PASSO - Configuração

### **ETAPA 1: Criar App no Meta for Developers**

#### 1.1 Acessar Meta for Developers
```
https://developers.facebook.com/
```

#### 1.2 Criar Novo App
```
1. Clicar em "Meus Apps"
2. "Criar App"
3. Tipo: "Empresa"
4. Nome do App: "Whaticket [Sua Empresa]"
5. Email de contato
6. Criar App ID
```

#### 1.3 Adicionar Produtos
**Para Facebook Messenger:**
```
1. Dashboard do App
2. "Adicionar Produto"
3. Selecionar "Messenger"
4. Configurar
```

**Para Instagram:**
```
1. Dashboard do App
2. "Adicionar Produto"
3. Selecionar "Instagram"
4. Configurar
```

#### 1.4 Obter App ID e App Secret
```
1. Configurações → Básico
2. Copiar "ID do Aplicativo"
3. Copiar "Chave Secreta do Aplicativo" (clicar em "Mostrar")
```

---

### **ETAPA 2: Configurar Variáveis de Ambiente**

#### 2.1 Backend (.env ou docker-compose.yml)
```bash
# Token de Verificação do Webhook (criar um valor único)
VERIFY_TOKEN=whaticket_webhook_2025_xyz

# Facebook App (copiado do Meta for Developers)
FACEBOOK_APP_ID=seu_app_id_aqui
FACEBOOK_APP_SECRET=sua_app_secret_aqui
```

#### 2.2 Frontend (.env)
```bash
# Facebook App ID (mesmo do backend)
REACT_APP_FACEBOOK_APP_ID=seu_app_id_aqui

# Opcional: Se requer Business Management
REACT_APP_REQUIRE_BUSINESS_MANAGEMENT=FALSE
```

**Exemplo com docker-compose.yml:**
```yaml
services:
  backend:
    environment:
      VERIFY_TOKEN: "whaticket_webhook_2025_xyz"
      FACEBOOK_APP_ID: "1234567890123456"
      FACEBOOK_APP_SECRET: "abc123def456ghi789jkl012mno345pq"
```

---

### **ETAPA 3: Configurar Webhooks**

#### 3.1 URL do Webhook
Sua URL pública do backend:
```
https://seu-dominio.com.br/facebook
```

**Exemplos:**
```
https://chats.nobreluminarias.com.br/facebook
https://api.whaticket.com.br/facebook
https://meudominio.com.br:8080/facebook
```

#### 3.2 Configurar no Meta for Developers

**Para Facebook Messenger:**
```
1. Dashboard do App
2. Messenger → Configurações
3. Webhooks → "Adicionar URL de retorno de chamada"
4. URL: https://seu-dominio.com.br/facebook
5. Token de verificação: whaticket_webhook_2025_xyz
6. Clicar em "Verificar e salvar"
7. Campos de webhook:
   ☑ messages
   ☑ messaging_postbacks
   ☑ messaging_optins
   ☑ message_deliveries
   ☑ message_reads
   ☑ messaging_referrals
```

**Para Instagram:**
```
1. Dashboard do App
2. Instagram → Configurações
3. Webhooks → "Adicionar URL de retorno de chamada"
4. URL: https://seu-dominio.com.br/facebook
5. Token de verificação: whaticket_webhook_2025_xyz
6. Clicar em "Verificar e salvar"
7. Campos de webhook:
   ☑ messages
   ☑ messaging_postbacks
   ☑ messaging_optins
   ☑ message_deliveries
   ☑ message_reads
```

---

### **ETAPA 4: Configurar Permissões do App**

#### 4.1 Permissões Necessárias

**Para Facebook Messenger:**
```
☑ pages_messaging
☑ pages_show_list
☑ pages_manage_metadata
☑ pages_read_engagement
☑ public_profile
```

**Para Instagram:**
```
☑ instagram_basic
☑ instagram_manage_messages
☑ pages_messaging
☑ pages_show_list
☑ pages_manage_metadata
☑ pages_read_engagement
☑ public_profile
```

#### 4.2 Modo de Desenvolvimento vs Produção
```
1. Configurações → Básico
2. "Status do app" → Desenvolvimento
3. Para Produção: Enviar para análise da Meta
   (Necessário apenas para uso em larga escala)
```

---

### **ETAPA 5: Habilitar no Plano da Empresa**

#### 5.1 Acessar Painel Admin
```
1. Login como Admin
2. Menu: Empresas/Planos
3. Editar o Plano
```

#### 5.2 Ativar Facebook/Instagram
```
☑ Usar WhatsApp
☑ Usar Facebook     ← ATIVAR
☑ Usar Instagram    ← ATIVAR

Salvar
```

---

### **ETAPA 6: Conectar Página no Whaticket**

#### 6.1 Acessar Conexões
```
1. Login no Whaticket
2. Menu: Conexões
3. Botão: "Nova Conexão"
```

#### 6.2 Conectar Facebook
```
1. Clicar em dropdown "Nova Conexão"
2. Selecionar "Facebook"
3. Login com Facebook (popup)
4. Autorizar permissões
5. Selecionar Página do Facebook
6. Concluir
```

#### 6.3 Conectar Instagram
```
1. Clicar em dropdown "Nova Conexão"
2. Selecionar "Instagram"
3. Login com Facebook (popup)
4. Autorizar permissões
5. Selecionar Conta do Instagram
6. Concluir
```

---

## 🎯 Como Funciona

### Fluxo de Mensagens:

```
Cliente envia mensagem no Facebook/Instagram
  ↓
Meta envia webhook para seu backend
  ↓
Backend: /facebook endpoint
  ↓
Identifica canal (facebook ou instagram)
  ↓
Busca conexão pelo facebookPageUserId
  ↓
Processa mensagem (facebookMessageListener)
  ↓
Cria/atualiza contato
  ↓
Cria/atualiza ticket
  ↓
Salva mensagem no banco
  ↓
Emite evento Socket.IO
  ↓
Frontend atualiza interface
  ↓
Atendente visualiza e responde
  ↓
Resposta enviada via Graph API
  ↓
Cliente recebe no Facebook/Instagram ✅
```

---

## 📊 Interface no Whaticket

### Lista de Conexões:

```
┌─────────────────────────────────────────┐
│ 📱 Conexões (3)                         │
│                                         │
│ ✅ WhatsApp - Atendimento               │
│    Status: Conectado                    │
│                                         │
│ ✅ Facebook - Página Empresa            │
│    Status: Conectado                    │
│                                         │
│ ✅ Instagram - @minhaempresa            │
│    Status: Conectado                    │
└─────────────────────────────────────────┘
```

### Tickets:

```
┌─────────────────────────────────────────┐
│ 📥 ATENDENDO (5)                        │
│                                         │
│ 💬 João Silva                           │
│    WhatsApp • Fila: Vendas              │
│    Última msg: "Olá, preciso de..."    │
│                                         │
│ 💙 Maria Santos                         │
│    Facebook • Fila: Suporte             │
│    Última msg: "Quando chega meu..."   │
│                                         │
│ 📸 Pedro Lima                           │
│    Instagram • Fila: SAC                │
│    Última msg: "Vi esse produto..."    │
└─────────────────────────────────────────┘
```

### Chat:

```
┌─────────────────────────────────────────┐
│ 💙 Maria Santos (Facebook)              │
│ Online • Atendido por: Você             │
├─────────────────────────────────────────┤
│                                         │
│  Maria Santos  11:30                    │
│  ┌────────────────────────────┐        │
│  │ Olá! Quero saber sobre o   │        │
│  │ produto X. Quanto custa?   │        │
│  └────────────────────────────┘        │
│                                         │
│                         Você  11:31     │
│        ┌────────────────────────────┐  │
│        │ Olá Maria! O produto X     │  │
│        │ custa R$ 99,90. Posso      │  │
│        │ te ajudar com algo mais?   │  │
│        └────────────────────────────┘  │
│                                         │
│  📎 Anexar  😊 Emoji  ✍️ Resposta rápida│
│  ┌─────────────────────────────────┐   │
│  │ Digite sua mensagem...          │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

---

## 🔐 Segurança e Boas Práticas

### 1️⃣ Tokens e Secrets
```
✅ NUNCA commitar no Git
✅ Usar variáveis de ambiente
✅ Rotacionar periodicamente
✅ Usar secrets do Docker/Kubernetes
```

### 2️⃣ HTTPS Obrigatório
```
❌ http://meudominio.com.br → Não funciona
✅ https://meudominio.com.br → Funciona
```

### 3️⃣ Verificação de Webhook
```
✅ Token único e complexo
✅ Validar origem das requisições
✅ Verificar assinatura (opcional)
```

### 4️⃣ Rate Limiting
```
Meta tem limites de requisições:
- Messenger: 1000 mensagens/hora por página
- Instagram: Similar ao Messenger
```

---

## 🧪 Como Testar

### Teste 1: Webhook Configurado
```bash
# Testar verificação do webhook
curl "https://seu-dominio.com.br/facebook?hub.mode=subscribe&hub.verify_token=whaticket_webhook_2025_xyz&hub.challenge=CHALLENGE_ACCEPTED"

# Esperado: Retorna "CHALLENGE_ACCEPTED"
```

### Teste 2: Enviar Mensagem de Teste

**Facebook:**
```
1. Abrir página do Facebook
2. Clicar em "Mensagens"
3. Enviar mensagem de teste
4. Verificar se aparece no Whaticket
```

**Instagram:**
```
1. Abrir perfil no Instagram
2. Enviar DM para sua conta
3. Verificar se aparece no Whaticket
```

### Teste 3: Responder Mensagem
```
1. Abrir ticket no Whaticket
2. Digitar resposta
3. Enviar
4. Verificar se chegou no Facebook/Instagram
```

---

## 🐛 Troubleshooting

### Problema: Webhook não valida
**Sintomas:**
```
Erro ao configurar webhook no Meta for Developers
"The URL couldn't be validated"
```

**Soluções:**
```
1. Verificar se BACKEND está acessível publicamente
2. Verificar HTTPS (obrigatório)
3. Verificar VERIFY_TOKEN no .env
4. Conferir rota: /facebook existe?
5. Verificar logs do backend
```

### Problema: Mensagens não chegam
**Sintomas:**
```
Cliente envia mensagem no Facebook/Instagram
Não aparece no Whaticket
```

**Soluções:**
```
1. Verificar se webhook está ativo
2. Conferir logs do backend:
   docker logs whaticket-backend -f
3. Verificar se facebookPageUserId está correto
4. Testar endpoint manualmente:
   curl -X POST https://seu-dominio.com.br/facebook
```

### Problema: Não consegue responder
**Sintomas:**
```
Envia mensagem no Whaticket
Não chega no Facebook/Instagram
Erro no console
```

**Soluções:**
```
1. Verificar token da página
2. Verificar permissões do App
3. Conferir logs:
   "Error sending message to Facebook"
4. Verificar Graph API:
   https://developers.facebook.com/tools/explorer/
```

### Problema: App em modo desenvolvimento
**Sintomas:**
```
Funciona para você (admin)
Não funciona para clientes
```

**Soluções:**
```
1. Dashboard do App → Configurações
2. Mudar para "App Público" ou
3. Adicionar testadores:
   Funções → Testadores → Adicionar usuário
```

---

## 📖 Recursos Úteis

### Documentação Oficial:
```
Facebook Messenger Platform:
https://developers.facebook.com/docs/messenger-platform/

Instagram Messaging API:
https://developers.facebook.com/docs/messenger-platform/instagram

Graph API:
https://developers.facebook.com/docs/graph-api/

Webhooks:
https://developers.facebook.com/docs/messenger-platform/webhooks
```

### Ferramentas de Debug:
```
Graph API Explorer:
https://developers.facebook.com/tools/explorer/

Webhook Tester:
https://webhook.site/
```

---

## 🎓 Limitações e Observações

### Messenger:
```
✅ Mensagens de texto
✅ Imagens, vídeos, áudios
✅ Documentos
✅ Botões e respostas rápidas
⚠️  Stories (não suportado pela API)
⚠️  Reactions (limitado)
```

### Instagram:
```
✅ DMs privadas
✅ Imagens, vídeos
✅ Respostas rápidas
⚠️  Stories (requer API separada)
⚠️  Comentários (requer API separada)
⚠️  Mentions (requer API separada)
```

### Limites:
```
- 1000 mensagens/hora por página (Facebook)
- 250 mensagens/hora por usuário (Instagram)
- 24h de janela para responder (sem template)
```

---

## ✅ Checklist de Implementação

### Configuração Inicial:
- [ ] Criar App no Meta for Developers
- [ ] Adicionar produtos: Messenger, Instagram
- [ ] Obter App ID e App Secret
- [ ] Configurar FACEBOOK_APP_ID no backend
- [ ] Configurar FACEBOOK_APP_SECRET no backend
- [ ] Configurar VERIFY_TOKEN no backend
- [ ] Configurar REACT_APP_FACEBOOK_APP_ID no frontend

### Webhooks:
- [ ] Configurar webhook Messenger
- [ ] Configurar webhook Instagram
- [ ] Testar validação do webhook
- [ ] Verificar campos subscritos

### Permissões:
- [ ] Solicitar permissões necessárias
- [ ] Adicionar testadores (se em desenvolvimento)
- [ ] Enviar para revisão (se produção)

### Whaticket:
- [ ] Habilitar Facebook no plano
- [ ] Habilitar Instagram no plano
- [ ] Conectar página do Facebook
- [ ] Conectar conta do Instagram

### Testes:
- [ ] Enviar mensagem de teste (Facebook)
- [ ] Enviar mensagem de teste (Instagram)
- [ ] Responder mensagem (Facebook)
- [ ] Responder mensagem (Instagram)
- [ ] Testar envio de mídia
- [ ] Testar criação de ticket
- [ ] Testar atribuição de atendente
- [ ] Testar chatbot (se configurado)

---

## 🎉 Resultado Final

Com a integração completa, você terá:

✅ **Multicanal Unificado:**
- WhatsApp
- Facebook Messenger
- Instagram Direct

✅ **Gestão Centralizada:**
- Todos os atendimentos em um só lugar
- Mesma interface para todos os canais
- Histórico completo de conversas

✅ **Automação:**
- Chatbot funciona em todos os canais
- Distribuição automática de tickets
- Respostas rápidas

✅ **Produtividade:**
- Atendentes gerenciam tudo em uma tela
- Não precisa alternar entre apps
- Relatórios unificados

---

**PRONTO PARA COMEÇAR!** 🚀

Seu Whaticket já está 100% preparado para Facebook e Instagram. Basta seguir os passos acima para ativar! 🎊

