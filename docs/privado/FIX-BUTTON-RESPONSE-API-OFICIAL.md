# 🔘 FIX: Mensagens [button] da API Oficial do WhatsApp

## Problema Reportado

Ao enviar campanhas via **API Oficial do WhatsApp** com botões interativos, quando o cliente clica em um botão, a resposta aparece apenas como `[button]` ao invés de mostrar qual botão foi clicado.

## Causa Raiz

### Backend - wbotMessageListener.ts

O sistema processa respostas de botões em dois cenários:

**1. Mensagens ENVIADAS com botões (funciona corretamente):**
```typescript
// Linha 489
let bodyMessage = `[BUTTON]\n\n*${msg?.message?.buttonsMessage?.contentText}*\n\n`;
```

**2. Mensagens RECEBIDAS (resposta do cliente):**
```typescript
// Linhas 644-653
buttonsResponseMessage:
  msg.message?.buttonsResponseMessage?.selectedDisplayText,
listResponseMessage:
  msg.message?.listResponseMessage?.title ||
  msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
templateButtonReplyMessage:
  msg.message?.templateButtonReplyMessage?.selectedId,
```

### O Problema

Quando a mensagem vem da **API Oficial do WhatsApp**, o formato pode ser diferente do Baileys (WhatsApp Web). Os campos esperados podem não estar preenchidos, resultando em `body = null` ou `body = undefined`, que é salvo como texto vazio ou como o marcador `[button]`.

## Solução

### Opção 1: Melhorar Extração de Resposta de Botão

Adicionar fallbacks para extrair o texto do botão clicado de diferentes formatos da API Oficial:

```typescript
buttonsResponseMessage: 
  msg.message?.buttonsResponseMessage?.selectedDisplayText ||
  msg.message?.buttonsResponseMessage?.selectedButtonId ||
  "Resposta de botão",
```

### Opção 2: Processar Webhook da API Oficial

Se você está usando a API Oficial do WhatsApp, as respostas de botões chegam via webhook com um formato específico. O sistema precisa processar corretamente o webhook para extrair:

- `interactive.button_reply.id` - ID do botão clicado
- `interactive.button_reply.title` - Texto do botão clicado
- `interactive.list_reply.id` - ID da opção de lista selecionada
- `interactive.list_reply.title` - Texto da opção selecionada

## Diagnóstico

Para identificar exatamente como a mensagem está chegando, precisamos:

1. **Ver o dataJson de uma mensagem real** com resposta de botão
2. **Verificar os logs do webhook** da API Oficial
3. **Confirmar qual canal** está sendo usado (Baileys ou API Oficial)

## Próximos Passos

1. Executar query no banco para encontrar mensagens com `[button]`:
```sql
SELECT id, body, "fromMe", "mediaType", "dataJson", "createdAt"
FROM "Messages"
WHERE body ILIKE '%button%'
ORDER BY "createdAt" DESC
LIMIT 5;
```

2. Analisar o `dataJson` para ver o formato exato da resposta

3. Implementar correção específica para o formato identificado

## Observação Importante

O frontend **JÁ TEM** suporte para renderizar botões interativos através do componente `ButtonsPreview`. O problema está na **extração do texto** da resposta do botão no backend, não na renderização.
