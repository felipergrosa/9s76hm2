# 🔧 FIX: Timeout na Sessão da API Oficial

## Problema Reportado

A API Oficial (sessão 25) estava apresentando timeout ao tentar recuperar a sessão:
```
ERROR [28-03-2026 08:45:11]: [getWbotOrRecover] Timeout aguardando sessão 25 após 30 tentativas
ERROR [28-03-2026 08:45:17]: [getWbotOrRecover] Timeout aguardando sessão 25 após 30 tentativas
```

## Causa Raiz

O problema estava na função `triggerSessionRecovery` (linha 406 do wbot.ts). A verificação de canal **rejeitava a API Oficial**:

### Código com problema:
```typescript
// Linha 406 - VERIFICAÇÃO INCORRETA
if (whatsapp.status === "DISCONNECTED" || whatsapp.channel !== "whatsapp") {
  logger.info(`[triggerSessionRecovery] WhatsApp ${whatsappId} status=${whatsapp.status}, channel=${whatsapp.channel}. Não recuperando.`);
  reconnectingWhatsapps.delete(whatsappId);
  clearTimeout(safetyTimeout);
  return;
}
```

**Problema:** 
- API Oficial usa `channelType = "official"` 
- Baileys usa `channel = "whatsapp"`
- A condição `whatsapp.channel !== "whatsapp"` era verdadeira para API Oficial
- Resultado: O recovery **não era iniciado** para a API Oficial

## Solução Aplicada

### Arquivo: backend/src/libs/wbot.ts
**Correção na linha 407-408:**
```typescript
// Verificar se deve estar conectado
// Aceita tanto "whatsapp" (Baileys) quanto "official" (API Oficial)
if (whatsapp.status === "DISCONNECTED" || 
    (whatsapp.channel !== "whatsapp" && whatsapp.channelType !== "official")) {
  logger.info(`[triggerSessionRecovery] WhatsApp ${whatsappId} status=${whatsapp.status}, channel=${whatsapp.channel}, channelType=${whatsapp.channelType}. Não recuperando.`);
  reconnectingWhatsapps.delete(whatsappId);
  clearTimeout(safetyTimeout);
  return;
}
```

### O que mudou:
1. **Verificação expandida**: Agora aceita `channelType = "official"`
2. **Log melhorado**: Inclui `channelType` no log para debug
3. **Condição correta**: Permite recovery tanto para Baileys quanto para API Oficial

## Como o Recovery Funciona

1. **getWbotOrRecover** é chamado (ex: ao deletar mensagem)
2. Verifica se sessão existe no array `sessions`
3. Se não existe, chama `triggerSessionRecovery`
4. `triggerSessionRecovery` verifica se deve recuperar:
   - Status não pode ser "DISCONNECTED"
   - Canal deve ser "whatsapp" (Baileys) ou "official" (API Oficial) ✅
5. Se passar na verificação, chama `StartWhatsAppSessionUnified`
6. `StartWhatsAppSessionUnified` detecta o tipo e inicializa corretamente

## Comportamento Esperado Após Correção

### Antes:
- ❌ API Oficial: Recovery não iniciado → Timeout
- ✅ Baileys: Recovery funcionava normalmente

### Depois:
- ✅ API Oficial: Recovery iniciado corretamente
- ✅ Baileys: Recovery continua funcionando

## Teste da Correção

1. **Reinicie o backend**:
```bash
cd backend
npm run dev
```

2. **Simule o problema**:
   - Pare a API Oficial (se possível)
   - Tente uma operação que precise da sessão (ex: deletar mensagem)
   - Verifique nos logs se aparece:
     ```
     [triggerSessionRecovery] WhatsApp 25 encontrado: status=CONNECTED, channel=API-oficial, channelType=official
     [StartSession] Iniciando official para whatsappId=25
     ```

3. **Verifique se não aparece mais**:
   ```
   [getWbotOrRecover] Timeout aguardando sessão 25
   ```

## Logs Esperados

Com a correção, os logs devem mostrar:
```
INFO [triggerSessionRecovery] WhatsApp 25 encontrado: status=CONNECTED, channel=API-oficial, channelType=official
INFO [triggerSessionRecovery] Chamando StartWhatsAppSession para 25 (API-oficial)
INFO [StartSession] Iniciando official para whatsappId=25
INFO [StartSession] Usando Official API para whatsappId=25
INFO [StartSession] Official API conectada: 5519995598754
```

## Status

✅ **CORREÇÃO APLICADA** - O recovery da sessão da API Oficial agora será iniciado corretamente, eliminando os timeouts.
