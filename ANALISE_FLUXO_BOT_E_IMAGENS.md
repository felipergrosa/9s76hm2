# 🔍 ANÁLISE COMPLETA: Fluxo BOT e Imagens

## 📋 PROBLEMAS IDENTIFICADOS

### 1. ❌ Mensagem vai direto para "BOT" sem fila
### 2. ❌ Imagens não aparecem
### 3. ⚠️ Lógica de distribuição de abas confusa

---

## 1️⃣ FLUXO ATUAL DE DISTRIBUIÇÃO (PROBLEMA)

### Como Funciona Hoje:

**Arquivo:** `FindOrCreateTicketService.ts` linha 140

```typescript
status: (!isImported && !isNil(settings.enableLGPD)
  && openAsLGPD && !groupContact) ? 
  "lgpd" :  
  (whatsapp.groupAsTicket === "enabled" || !groupContact) ? 
    (!groupContact && !isCampaign ? "bot" : "pending") :  // ← AQUI!
    "group",
```

### Traduzindo:

```
Nova mensagem chega:
  ↓
É LGPD? → Sim → status = "lgpd"
  ↓ Não
É grupo? → Não
  ↓
É campanha? → Não
  ↓
status = "BOT"  ← SEMPRE BOT! ❌
```

### ❌ PROBLEMA:

**Todos os tickets novos vão para "BOT" automaticamente!**
- Não verifica se a fila tem chatbot configurado
- Não verifica se o bot está ativo
- Ignora configuração de filas

---

## 2️⃣ LÓGICA CORRETA DO BOT

### Como DEVERIA Funcionar:

```
Nova mensagem chega:
  ↓
1. Encontra/cria ticket (status inicial: "pending")
  ↓
2. Verifica se tem fila:
   SIM → Atribui fila ao ticket
   NÃO → Fica em "pending" aguardando escolha
  ↓
3. Fila tem CHATBOT configurado?
   SIM → status = "bot" + isBot = true
   NÃO → status = "pending" + isBot = false
  ↓
4. Chatbot processa ou passa para atendente
```

### Exemplo Real:

```
Empresa tem 3 filas:

┌─────────────┬──────────┬────────────┐
│ Fila        │ Chatbot? │ Status     │
├─────────────┼──────────┼────────────┤
│ Vendas      │ SIM      │ → "bot"    │
│ Suporte     │ SIM      │ → "bot"    │
│ Financeiro  │ NÃO      │ → "pending"│
└─────────────┴──────────┴────────────┘

Cliente escolhe "Vendas":
  → Ticket vai para aba "BOT"
  → Chatbot responde automaticamente

Cliente escolhe "Financeiro":
  → Ticket vai para aba "PENDENTES"
  → Aguarda atendente humano
```

---

## 3️⃣ ONDE VERIFICAR CHATBOT

### No Código Atual (correto em outros lugares):

**Facebook Listener:**
```typescript
// services/FacebookServices/facebookMessageListener.ts:931
await UpdateTicketService({
  ticketData: { 
    queueId: queues[0].id, 
    isBot: chatbot  // ← Aqui verifica se fila tem chatbot!
  },
  ticketId: ticket.id,
  companyId: ticket.companyId
});
```

**Baileys Listener:**
```typescript
// services/WbotServices/wbotMessageListener.ts:1499
if (queues.length === 1) {
  chatbot = queues[0]?.chatbots.length > 1;  // ← Verifica chatbots da fila
}
```

```typescript
// services/WbotServices/wbotMessageListener.ts:1915
if (choosenQueue.chatbots.length > 0 && !ticket.isGroup) {
  // Lista opções de chatbots
  choosenQueue.chatbots.forEach((chatbot, index) => {
    options += `*[ ${index + 1} ]* - ${chatbot.name}\n`;
  });
}
```

### ✅ CONCLUSÃO:

A lógica de verificar chatbot **JÁ EXISTE** em outros lugares!

Precisamos aplicar no `FindOrCreateTicketService`!

---

## 🔧 CORREÇÃO NECESSÁRIA

### Modificar `FindOrCreateTicketService.ts`:

**ANTES ❌:**
```typescript
status: (!isImported && !isNil(settings.enableLGPD)
  && openAsLGPD && !groupContact) ? 
  "lgpd" :  
  (whatsapp.groupAsTicket === "enabled" || !groupContact) ? 
    (!groupContact && !isCampaign ? "bot" : "pending") :  // ← Sempre bot!
    "group",
isBot: groupContact ? false : true,  // ← Sempre true!
```

**DEPOIS ✅:**
```typescript
status: (!isImported && !isNil(settings.enableLGPD)
  && openAsLGPD && !groupContact) ? 
  "lgpd" :  
  (whatsapp.groupAsTicket === "enabled" || !groupContact) ? 
    "pending" :  // ← SEMPRE pending inicialmente
    "group",
isBot: false,  // ← SEMPRE false inicialmente
```

### Por quê?

1. **Ticket nasce como "pending"** (aguardando fila)
2. Quando fila for atribuída, **SE** fila tiver chatbot → muda para "bot"
3. Se não tiver chatbot → fica "pending"

### Fluxo Completo:

```typescript
// 1. Criar ticket (pending)
ticket = await Ticket.create({
  status: "pending",
  isBot: false,
  ...
});

// 2. Atribuir fila (se houver)
if (queueId) {
  const queue = await Queue.findByPk(queueId, {
    include: [{ model: Chatbot, as: "chatbots" }]
  });
  
  const hasBot = queue.chatbots && queue.chatbots.length > 0;
  
  await ticket.update({
    queueId: queue.id,
    status: hasBot ? "bot" : "pending",
    isBot: hasBot
  });
}
```

---

## 4️⃣ PROBLEMA DAS IMAGENS 🖼️

### Análise da Imagem 2 (DevTools):

```
URL Gerada:
https://chatsapi.nobreluminarias.com.br/public/company1/contact1676/1703441966659_image.png

Caminho esperado no servidor:
backend/public/company1/contact1676/1703441966659_image.png
```

### ❌ PROBLEMA IDENTIFICADO:

**Getter do Message.ts constrói URL incorretamente!**

```typescript
// Message.ts linha 61
const base = origin
  ? `${origin}/public/company${this.companyId}/${fileRel}`
  : `/public/company${this.companyId}/${fileRel}`;
```

**Se `fileRel` = `contact1676/1703441966659_image.png`:**

```
URL construída:
http://localhost:8080/public/company1/contact1676/1703441966659_image.png
                                       ↑ CORRETO!

Mas arquivo está em:
backend/public/company1/contact1676/1703441966659_image.png
                      ↑ CORRETO!

✅ URL ESTÁ CORRETA!
```

### Então por que não aparece? 🤔

#### Possibilidade 1: Arquivo não existe fisicamente ❌

```bash
# Verificar se arquivo existe:
ls backend/public/company1/contact1676/

# Se vazio ou arquivo não existe → Não foi salvo corretamente
```

#### Possibilidade 2: Permissões ❌

```bash
# Verificar permissões:
ls -la backend/public/company1/contact1676/

# Se não tiver permissão 777 → Browser não consegue acessar
```

#### Possibilidade 3: Express não serve a pasta ❌

```typescript
// app.ts - Verificar se tem:
app.use("/public", express.static(uploadConfig.directory));
```

**Se falta isso → Express não serve os arquivos!**

#### Possibilidade 4: CORS ❌

```
Browser bloqueia por política CORS
```

#### Possibilidade 5: HTTPS + Mixed Content ❌

```
Frontend: HTTPS
Backend: HTTP

Browser bloqueia imagens HTTP em página HTTPS
```

---

## 🔍 DIAGNÓSTICO PASSO A PASSO

### Teste 1: Arquivo existe?

```bash
# Backend
cd backend
ls -la public/company1/contact1676/

# Resultado esperado:
-rwxrwxrwx 1 user group 123456 Nov 18 09:30 1703441966659_image.png

# Se não aparecer → Arquivo não foi salvo!
```

### Teste 2: Verificar banco

```sql
SELECT id, "mediaUrl", "contactId", "ticketId", "fromMe"
FROM "Messages"
WHERE "mediaUrl" LIKE '%1703441966659%';

-- Resultado esperado:
-- mediaUrl: contact1676/1703441966659_image.png
```

**Se mediaUrl está diferente:**
- ❌ `1703441966659_image.png` (falta contact1676/)
- ❌ `/public/company1/contact1676/...` (caminho completo, errado!)
- ✅ `contact1676/1703441966659_image.png` (CORRETO)

### Teste 3: Acesso direto

```
Abrir navegador:
https://chatsapi.nobreluminarias.com.br/public/company1/contact1676/1703441966659_image.png

Se:
✅ Imagem abre → Problema no frontend
❌ 404 Not Found → Arquivo não existe ou Express não serve
❌ 403 Forbidden → Permissão negada
❌ 500 Error → Erro no servidor
```

### Teste 4: Express servindo?

```typescript
// backend/src/app.ts
// Procurar por:
app.use("/public", express.static(...));

// Se não tem → Adicionar!
```

### Teste 5: Variável de ambiente

```bash
# backend/.env
cat backend/.env | grep BACKEND_URL

# Resultado esperado:
BACKEND_URL=https://chatsapi.nobreluminarias.com.br

# Se está errado ou vazio → Getter constrói URL errada
```

---

## 🔧 CORREÇÕES PRIORITÁRIAS

### 1. Corrigir Lógica BOT

**Arquivo:** `backend/src/services/TicketServices/FindOrCreateTicketService.ts`

```typescript
// Linha 136-146
const ticketData: any = {
  contactId: groupContact ? groupContact.id : contact.id,
  status: (!isImported && !isNil(settings.enableLGPD)
    && openAsLGPD && !groupContact) ? 
    "lgpd" :  
    (whatsapp.groupAsTicket === "enabled" || !groupContact) ? 
      "pending" :  // ← Mudar para pending
      "group",
  isGroup: !!groupContact,
  unreadMessages,
  whatsappId: whatsapp.id,
  companyId,
  isBot: false,  // ← Mudar para false
  channel,
  imported: isImported ? new Date() : null,
  isActiveDemand: false,
};
```

**Depois, na linha 179+, quando atribui fila:**

```typescript
if (queueId != 0 && !isNil(queueId)) {
  // Buscar fila com chatbots
  const queue = await Queue.findByPk(queueId, {
    include: [{ 
      model: Chatbot, 
      as: "chatbots",
      attributes: ["id", "name"]
    }]
  });
  
  if (queue) {
    const hasBot = queue.chatbots && queue.chatbots.length > 0;
    
    await ticket.update({
      queueId: queue.id,
      status: ticket.status === "pending" ? (hasBot ? "bot" : "pending") : ticket.status,
      isBot: hasBot
    });
  }
}
```

---

### 2. Investigar Imagens

#### Verificação Rápida:

```bash
# 1. Backend - Verificar arquivo
ls backend/public/company1/contact1676/

# 2. Backend - Verificar Express
grep -n "express.static" backend/src/app.ts

# 3. Backend - Verificar .env
cat backend/.env | grep BACKEND_URL

# 4. Banco - Verificar mediaUrl
psql -d whaticket -c "SELECT \"mediaUrl\" FROM \"Messages\" WHERE \"mediaUrl\" LIKE '%contact1676%' LIMIT 5;"
```

#### Se arquivo NÃO existe:

**Problema:** Arquivo não está sendo salvo fisicamente

**Verificar:**
1. `wbotMessageListener.ts` - função `downloadMedia`
2. `DownloadOfficialMediaService.ts` - salvamento
3. Permissões da pasta `public/`

#### Se arquivo existe mas não carrega:

**Problema:** Express não está servindo ou CORS

**Verificar:**
1. `app.ts` - linha do `express.static`
2. Nginx/Proxy reverso
3. HTTPS/HTTP mixed content

---

## 📊 FLUXO CORRETO COMPLETO

### Cenário 1: Fila COM Chatbot

```
Cliente envia mensagem
  ↓
FindOrCreateTicketService
  ↓
Cria ticket:
  - status: "pending"
  - isBot: false
  - queueId: null
  ↓
Cliente escolhe fila "Vendas"
  ↓
Verifica fila:
  - Fila "Vendas" tem chatbot? SIM
  ↓
Atualiza ticket:
  - queueId: 1 (Vendas)
  - status: "bot"  ← MUDA AQUI!
  - isBot: true    ← MUDA AQUI!
  ↓
Ticket aparece na aba "BOT" ✅
Chatbot processa ✅
```

### Cenário 2: Fila SEM Chatbot

```
Cliente envia mensagem
  ↓
FindOrCreateTicketService
  ↓
Cria ticket:
  - status: "pending"
  - isBot: false
  - queueId: null
  ↓
Cliente escolhe fila "Financeiro"
  ↓
Verifica fila:
  - Fila "Financeiro" tem chatbot? NÃO
  ↓
Atualiza ticket:
  - queueId: 3 (Financeiro)
  - status: "pending"  ← CONTINUA pending!
  - isBot: false       ← CONTINUA false!
  ↓
Ticket aparece na aba "PENDENTES" ✅
Aguarda atendente humano ✅
```

### Cenário 3: Sem Fila (Escolha Manual)

```
Cliente envia mensagem
  ↓
FindOrCreateTicketService
  ↓
Cria ticket:
  - status: "pending"
  - isBot: false
  - queueId: null
  ↓
Exibe opções de filas
  ↓
Aguarda escolha do cliente
  ↓
Ticket aparece na aba "PENDENTES" ✅
(até escolher a fila)
```

---

## ✅ CHECKLIST DE CORREÇÕES

### Backend:

- [ ] Modificar `FindOrCreateTicketService.ts`:
  - [ ] status inicial = "pending"
  - [ ] isBot inicial = false
  
- [ ] Adicionar lógica após atribuir fila:
  - [ ] Buscar chatbots da fila
  - [ ] Se tem chatbot → status="bot", isBot=true
  - [ ] Se não tem → status="pending", isBot=false

- [ ] Verificar `app.ts`:
  - [ ] Tem `app.use("/public", express.static(...))`?
  
- [ ] Verificar `.env`:
  - [ ] `BACKEND_URL` está correto?

- [ ] Verificar pastas:
  - [ ] `backend/public/company1/contactX/` existe?
  - [ ] Permissões 777?

### Banco de Dados:

- [ ] Verificar Messages:
  - [ ] `mediaUrl` tem formato correto? (`contactX/arquivo.ext`)
  - [ ] Não tem caminho completo? (`/public/...`)

### Testes:

- [ ] Cliente envia mensagem → vai para "PENDENTES"
- [ ] Cliente escolhe fila COM bot → vai para "BOT"
- [ ] Cliente escolhe fila SEM bot → fica em "PENDENTES"
- [ ] Imagem aparece corretamente no chat

---

## 🎯 RESUMO EXECUTIVO

### Problema 1: BOT sempre ativo

**Causa:** `FindOrCreateTicketService` define `status="bot"` e `isBot=true` **sempre**

**Solução:** Iniciar como `"pending"` e `false`, mudar para `"bot"` somente se fila tiver chatbot

### Problema 2: Imagens não aparecem

**Possíveis causas:**
1. Arquivo não foi salvo fisicamente
2. Express não serve pasta `/public`
3. Permissões incorretas
4. URL está sendo construída errada

**Próximos passos:**
1. Verificar se arquivo existe no disco
2. Verificar `app.ts` tem `express.static`
3. Testar acesso direto à imagem
4. Verificar logs do backend ao enviar imagem

---

**PRÓXIMA AÇÃO:** Implementar correções na ordem de prioridade! 🚀
