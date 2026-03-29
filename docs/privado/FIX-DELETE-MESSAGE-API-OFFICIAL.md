# 🔧 FIX: Deleção de Mensagens da API Oficial

## Problema Reportado

Ao tentar apagar uma mensagem de um chat da API Oficial, o sistema retornava erro:
```
ERR_DELETE_WAPP_MSG
```

## Causa Raiz

O **MessageController** estava usando o serviço `DeleteWhatsAppMessage` (antigo, apenas Baileys) ao invés do `DeleteWhatsAppMessageUnified` que suporta API Oficial.

### Arquivo: backend/src/controllers/MessageController.ts
**Linha 1232 (antes):**
```typescript
const message = await DeleteWhatsAppMessage(messageId, companyId);
```

**Problema:** O serviço `DeleteWhatsAppMessage` tenta usar Baileys (`WASocket.sendMessage`) para deletar mensagens, mas a API Oficial não usa Baileys.

## Solução Aplicada

### 1. Importação do Serviço Unificado
Adicionada importação do `DeleteWhatsAppMessageUnified`:
```typescript
import DeleteWhatsAppMessageUnified from "../services/WbotServices/DeleteWhatsAppMessageUnified";
```

### 2. Atualização da Função remove()
A função foi atualizada para:
- Buscar a mensagem com o ticket incluído
- Usar o serviço unificado que detecta automaticamente o canal
- Remover verificação duplicada (o serviço unificado já deleta do banco)

**Código corrigido:**
```typescript
// Buscar ticket primeiro para passar ao serviço unificado
const message = await Message.findByPk(messageId, {
  include: [
    {
      model: Ticket,
      as: "ticket",
      include: ["contact"]
    }
  ]
});

if (!message) {
  return res.status(404).json({ error: "Mensagem não encontrada" });
}

// Usar serviço unificado que suporta API Oficial
await DeleteWhatsAppMessageUnified({ 
  messageId, 
  ticket: message.ticket 
});
```

## Como o DeleteWhatsAppMessageUnified Funciona

1. **Detecção do Canal**: Usa `GetTicketAdapter()` para identificar se é Baileys ou API Oficial
2. **Validação de Restrições**: 
   - API Oficial: só permite deletar mensagens com até 24h
   - Baileys: pode deletar mensagens antigas
3. **Deleção no WhatsApp**: Tenta deletar via adapter (se possível)
4. **Deleção no Banco**: Remove a mensagem do banco de dados
5. **Evento Socket**: Emite evento para atualizar frontend em tempo real

## Restrições Importantes

### API Oficial do WhatsApp:
- ✅ Pode deletar mensagens enviadas por você
- ✅ Apenas mensagens com menos de 24 horas
- ❌ Não pode deletar mensagens recebidas do cliente
- ❌ Não pode deletar mensagens antigas (>24h)

### Baileys (WhatsApp Web):
- ✅ Pode deletar mensagens enviadas por você
- ✅ Pode deletar mensagens antigas
- ❌ Não pode deletar mensagens recebidas do cliente

## Teste da Correção

1. **Reinicie o backend**:
```bash
cd backend
npm run dev
```

2. **Teste deletando uma mensagem**:
   - Envie uma mensagem em um ticket da API Oficial
   - Tente deletar a mensagem (deve ter menos de 24h)
   - A mensagem deve ser removida com sucesso

3. **Verifique os logs**:
   - Deve aparecer: `[DeleteMessageUnified] Canal: official`
   - Deve aparecer: `[DeleteMessageUnified] Mensagem removida do banco`

## Comportamento Esperado

- **Mensagens < 24h (API Oficial)**: Deletada com sucesso ✅
- **Mensagens > 24h (API Oficial)**: Erro informativo sobre limite de tempo ⚠️
- **Mensagens Baileys**: Continua funcionando como antes ✅
- **Mensagens recebidas**: Erro de permissão (só pode deletar próprias mensagens) ⚠️

## Status

✅ **CORREÇÃO APLICADA** - O sistema agora usa o serviço unificado para deleção de mensagens, suportando corretamente tanto Baileys quanto API Oficial do WhatsApp.
