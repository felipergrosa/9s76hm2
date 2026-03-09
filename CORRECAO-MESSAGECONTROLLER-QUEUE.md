# Correção: MessageController Enviando Mensagens Diretamente

## Problema Identificado

Após adicionar `concurrency=1` nos processadores Bull Queue, o erro **"Connection Closed"** persistiu porque:

**MessageController.store estava IGNORANDO a fila Bull** e enviando mensagens **diretamente** via HTTP:

```
Requisição HTTP → MessageController.store → SendWhatsAppMessageUnified → Socket Baileys
                                                                         ↓
                                                                  Connection Closed
```

### Por Que Isso Causava o Erro

1. Usuário envia mensagem → HTTP request 1
2. Usuário envia outra mensagem → HTTP request 2 (simultânea)
3. **AMBAS** chamam `SendWhatsAppMessageUnified` diretamente
4. **AMBAS** acessam o **MESMO socket Baileys** ao mesmo tempo
5. Socket corrompe → **"Connection Closed"**

**A proteção `concurrency=1` da fila Bull NÃO se aplicava**, pois as mensagens nem entravam na fila.

## Correção Aplicada

### Arquivo Modificado: `backend/src/controllers/MessageController.ts`

**ANTES (❌ INCORRETO - Envio Direto):**
```typescript
if (ticket.channel === "whatsapp" && isPrivate === "false") {
  // Enviar mensagem DIRETAMENTE
  const sentMessage = await SendWhatsAppMessageUnified({ body, ticket, quotedMsg, vCard });
  
  // Extrair ID e salvar...
  const messageData = { ... };
  await CreateMessageService({ messageData, companyId: ticket.companyId });
}
```

**DEPOIS (✅ CORRETO - Via Fila Bull):**
```typescript
if (ticket.channel === "whatsapp" && isPrivate === "false") {
  // ENFILEIRAR mensagem via Bull Queue para evitar concorrência no socket
  console.log(`[MessageController.store] Enfileirando mensagem via Bull Queue para ticket ${ticketId}`);
  
  await messageQueue.add(
    "SendMessage",
    {
      whatsappId: ticket.whatsappId,
      data: {
        number: ticket.contact.number,
        body: body || "",
        quotedMsg: quotedMsg || undefined,
        vCard: vCard || undefined,
        companyId: ticket.companyId
      }
    },
    {
      priority: 1, // Alta prioridade para mensagens do usuário
      removeOnComplete: true,
      removeOnFail: false
    }
  );
  
  console.log(`[MessageController.store] Mensagem enfileirada com sucesso`);
}
```

### Import Adicionado

```typescript
import { messageQueue } from "../queues";
```

## Fluxo Corrigido

```
┌────────────────────────────────────────────────────┐
│ Usuário Envia Mensagem (HTTP)                      │
└────────────────┬───────────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────────┐
│ MessageController.store                            │
│  → Enfileira na messageQueue (Bull)                │
└────────────────┬───────────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────────┐
│ Bull Queue (Redis)                                 │
│  → Jobs aguardando processamento                   │
└────────────────┬───────────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────────┐
│ handleSendMessage (concurrency=1)                  │
│  → Processa APENAS 1 job por vez                   │
│  → Chama SendMessage → Socket Baileys              │
└────────────────┬───────────────────────────────────┘
                 ↓
        ✅ SOCKET PROTEGIDO
   (apenas 1 operação por vez)
```

## Diferença Entre Antes e Depois

| Aspecto | ANTES | DEPOIS |
|---------|-------|--------|
| **Envio** | Direto via HTTP | Via fila Bull Queue |
| **Concorrência** | Múltiplas requisições simultâneas | Serializado (1 por vez) |
| **Socket** | Acesso simultâneo = corrupção | Acesso serializado = protegido |
| **Erro "Connection Closed"** | ✅ Ocorria | ❌ NÃO deve ocorrer |

## Importante: Mídias Ainda Enviam Diretamente

⚠️ **ATENÇÃO:** Mensagens com **mídia** (imagens, vídeos, documentos) ainda são enviadas **diretamente** na linha 841:

```typescript
await SendWhatsAppMediaUnified({
  media,
  ticket,
  body: Array.isArray(body) ? body[index] : body,
  isPrivate: isPrivate === "true",
  isForwarded: false
});
```

Se o erro "Connection Closed" persistir ao **enviar mídias**, essa linha também precisará ser modificada para enfileirar via Bull.

## Como Testar

### 1. Rebuild do Backend

```bash
cd backend
npm run build
npm run dev
```

### 2. Testes Recomendados

**Teste 1: Mensagens de Texto Rápidas**
- Abrir ticket no frontend
- Enviar várias mensagens de texto rapidamente (uma após a outra)
- **Resultado Esperado:** TODAS as mensagens devem ser enviadas sem erro "Connection Closed"

**Teste 2: Mensagens Simultâneas (Múltiplos Usuários)**
- Dois usuários abrindo o MESMO contato
- Ambos enviando mensagens ao mesmo tempo
- **Resultado Esperado:** Todas as mensagens devem ser enviadas

**Teste 3: Adicionar Reação (Cenário Original do Erro)**
- Abrir ticket
- Adicionar reação a uma mensagem
- **Resultado Esperado:** Reação adicionada sem erro

### 3. Monitorar Logs

```bash
# Buscar por erros
grep "Connection Closed" logs/*.log
grep "xml-not-well-formed" logs/*.log

# Ver mensagens sendo enfileiradas
grep "Enfileirando mensagem via Bull Queue" logs/*.log
```

**Logs Esperados (Sucesso):**
```
[MessageController.store] Enfileirando mensagem via Bull Queue para ticket 4266
[MessageController.store] Mensagem enfileirada com sucesso
```

**Logs de Erro (Se Ainda Houver Problema):**
```
ERROR [...] Connection Closed
ERROR [...] xml-not-well-formed
```

## Resultado Esperado

✅ **ZERO** erros "Connection Closed" ao enviar mensagens de texto  
✅ Mensagens processadas em ordem (FIFO)  
✅ Socket Baileys protegido contra acesso simultâneo  
✅ Performance mantida (fila processa rapidamente)  

## Rollback (Se Necessário)

Se houver algum problema, reverter para envio direto:

```typescript
// Remover enfileiramento
const sentMessage = await SendWhatsAppMessageUnified({ body, ticket, quotedMsg, vCard });

// Processar sentMessage normalmente...
```

⚠️ **NÃO RECOMENDADO:** Reverter causará o retorno do erro "Connection Closed"

---

**Data:** 07/03/2026  
**Versão:** Baileys v7  
**Status:** ✅ CORREÇÃO APLICADA - AGUARDANDO TESTES  
**Próximo Passo:** Se erro persistir com mídias, aplicar mesma correção para SendWhatsAppMediaUnified
