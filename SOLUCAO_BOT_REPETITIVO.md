# SOLUÇÃO COMPLETA: Bot Repetindo Sempre a Mesma Resposta

## DIAGNÓSTICO

O problema foi identificado: **o servidor está rodando código desatualizado**.

Apesar das correções terem sido feitas nos arquivos TypeScript em `src/`, o servidor de produção roda os arquivos JavaScript compilados em `dist/`, que ainda estão na versão antiga.

### Provas do problema:

1. **`dist/services/IntegrationsServices/OpenAiService.js` (linha 244)**
   ```js
   - Ainda tem: "se não souber o nome pergunte"
   - Não tem: bloco de dados do CRM
   - Não tem: instrução para evitar repetir saudação
   ```

2. **`dist/services/WbotServices/ProcessWhatsAppWebhook.js` (linha 144)**
   ```js
   case "text":
     body = message.text?.body || "";
     break;  // ❌ Falta: mediaType = "conversation"
   ```

3. **`dist/services/WbotServices/ProcessOfficialBot.js` (linha 127)**
   ```js
   // ❌ Não está salvando mediaType: "conversation"
   ```

**Resultado**: O histórico de mensagens fica vazio, então a IA sempre responde como se fosse a primeira mensagem.

---

## SOLUÇÃO (PASSO A PASSO)

### Passo 1: Parar o servidor

```bash
# Se estiver rodando via PM2, Docker ou manualmente, pare o processo
# Exemplo PM2:
pm2 stop backend

# Exemplo Docker:
docker-compose down
```

### Passo 2: Limpar build antigo (opcional, mas recomendado)

```bash
cd /caminho/para/whaticket/backend
rm -rf dist
```

### Passo 3: Recompilar TypeScript → JavaScript

```bash
npm run build
```

**Aguarde até ver**: `Successfully compiled XX files`

### Passo 4: Verificar se o build foi atualizado

Confira se o arquivo `dist/services/IntegrationsServices/OpenAiService.js` agora contém:

```bash
# Linux/Mac
grep -A 5 "Format system prompt" dist/services/IntegrationsServices/OpenAiService.js

# Windows PowerShell
Select-String -Path "dist/services/IntegrationsServices/OpenAiService.js" -Pattern "Format system prompt" -Context 0,5
```

**Deve aparecer**:
- Blocos de `fantasyName`, `contactPerson`, `city`, etc.
- Instrução sobre "Evite repetir sempre a mesma saudação"
- **NÃO** deve ter mais "se não souber o nome pergunte"

### Passo 5: Reiniciar o servidor

```bash
npm run start:prod:migrate
# ou
npm run start:prod
# ou
pm2 start backend
# ou
docker-compose up -d
```

### Passo 6: Limpar histórico antigo do ticket 866

Para garantir um teste limpo, você tem 2 opções:

**Opção A: Fechar o ticket atual**
- No painel, feche o ticket 866.
- Inicie uma nova conversa (vai criar um ticket novo, limpo).

**Opção B: Limpar mensagens antigas (SQL)**
```sql
-- CUIDADO: isso apaga o histórico de mensagens do ticket 866
DELETE FROM Messages WHERE ticketId = 866;
```

### Passo 7: Testar a conversa

1. **Mensagem 1**: `ola bom dia`
   - Esperado: Saudação inicial + oferta de ajuda/catálogo

2. **Mensagem 2**: `quais produtos voce vende?`
   - Esperado: **NÃO repetir a saudação**
   - Deve explicar linhas de produtos da Nobre

3. **Mensagem 3**: `voce e uma ia?`
   - Esperado: Resposta direta, sem repetir "Olá, como posso ajudar..."

---

## VERIFICAÇÃO DOS LOGS

Após o rebuild, quando você testar, procure por estes logs no console do backend:

```
[IA][DEBUG] Mensagens buscadas do banco: { ticketId: 866, totalMessages: X, ... }
[IA][DEBUG] PromptSystem gerado: { ... promptPreview: "Instruções do Sistema..." }
[IA][DEBUG] Histórico preparado para IA: { totalInHistory: Y, history: [...] }
```

**O que verificar**:
- `totalMessages` deve aumentar a cada nova mensagem
- `totalInHistory` deve ser maior que 1 (se houver conversa anterior)
- Se `totalInHistory` for sempre 1, ainda há um problema com `mediaType`

---

## SE AINDA NÃO FUNCIONAR APÓS O REBUILD

Caso mesmo após rebuild + restart o bot ainda repita, me envie:

1. Os logs `[IA][DEBUG]` da conversa nova
2. Uma consulta SQL do histórico real no banco:

```sql
SELECT id, ticketId, fromMe, mediaType, body, createdAt 
FROM Messages 
WHERE ticketId = 866 
ORDER BY createdAt ASC;
```

3. O texto atual do prompt "Agent Nobre" (para verificar se não há instrução conflitante no prompt específico)

---

## RESUMO TÉCNICO DO QUE FOI CORRIGIDO

### 1. ProcessWhatsAppWebhook.ts (src)
```typescript
case "text":
  body = message.text?.body || "";
  mediaType = "conversation";  // ✅ ADICIONADO
  break;
```

### 2. ProcessOfficialBot.ts (src)
```typescript
await CreateMessageService({
  messageData: {
    wid: sentMessage.id,
    ticketId: ticket.id,
    contactId: ticket.contactId,
    body: body,
    fromMe: true,
    read: true,
    ack: 1,
    mediaType: "conversation"  // ✅ ADICIONADO
  },
  companyId
});
```

### 3. OpenAiService.ts (src)
- ❌ Removido: "se não souber o nome pergunte"
- ✅ Adicionado: "Evite repetir sempre a mesma saudação"
- ✅ Adicionado: Bloco de dados do CRM (fantasyName, city, segment, etc.)
- ✅ Adicionado: Logs de debug detalhados

---

## COMANDOS RÁPIDOS (RESUMO)

```bash
# 1. Parar servidor
pm2 stop backend  # ou docker-compose down

# 2. Ir para pasta backend
cd /caminho/para/whaticket/backend

# 3. Limpar build antigo
rm -rf dist

# 4. Recompilar
npm run build

# 5. Reiniciar
npm run start:prod:migrate  # ou pm2 start backend

# 6. Monitorar logs
pm2 logs backend --lines 100  # ou docker-compose logs -f backend
```

---

## CHECKLIST FINAL

- [ ] Build novo gerado (`npm run build`)
- [ ] Servidor reiniciado
- [ ] Histórico antigo do ticket 866 limpo (fechou ticket ou limpou mensagens)
- [ ] Teste com mensagens diferentes
- [ ] Bot **NÃO** repete a mesma saudação
- [ ] Logs `[IA][DEBUG]` mostram histórico crescendo

---

**Após seguir estes passos, o bot deve parar de repetir e manter o contexto da conversa.**
