# 🚀 Teste de Campanhas - API Oficial WhatsApp

## ✅ O QUE FOI CORRIGIDO

### 1️⃣ **Erro TypeScript** ✅
```
❌ ANTES: error TS2367: types '"document"' and '"ptt"' have no overlap
✅ DEPOIS: Comparação com 'ptt' removida
```

### 2️⃣ **Tickets Não Apareciam na Interface** ✅
```
❌ ANTES: Tickets criados com status "pending"
✅ DEPOIS: Tickets criados com status "bot"

Resultado:
- Tickets aparecem na aba 🤖 BOT
- Comportamento igual ao Baileys
- Visível na interface
```

### 3️⃣ **Imagens Enviadas Não Apareciam** ✅
```
❌ ANTES: Mídias enviadas não salvavam no banco
✅ DEPOIS: Mídias salvas com CreateMessageService

Resultado:
- Imagens aparecem no chat
- Vídeos aparecem no chat
- Áudios aparecem no chat
- Documentos aparecem no chat
```

---

## 🧪 COMO TESTAR CAMPANHAS

### Pré-requisitos:
```
✅ Backend compilado (npm run build)
✅ Backend rodando
✅ API Oficial configurada
✅ Número de telefone verificado na Meta
✅ Contatos importados no sistema
```

---

## 📋 TESTE 1: Campanha Simples (Texto)

### Passo a Passo:

#### 1. Criar Campanha
```
Menu: Campanhas → Nova Campanha

Configuração:
- Nome: "Teste API Oficial - Texto"
- Conexão: [Selecionar API Oficial]
- Mensagem: "Olá! Esta é uma mensagem de teste."
- Contatos: Selecionar 2-3 contatos
- Agendamento: Envio Imediato
```

#### 2. Iniciar Campanha
```
Clicar em "Iniciar Campanha"
```

#### 3. Verificar Logs
```
Backend deve mostrar:
✅ [SendUnified] Enviando mensagem para ticket X (whatsappId=Y)
✅ [OfficialAPI] Mensagem enviada: wamid.HBgN...
✅ [SOCKET EMIT] event=company-1-appMessage
```

#### 4. Verificar Tickets
```
Interface:
1. Ir para aba "ATENDENDO" ou "BOT"
2. Verificar se tickets foram criados
3. Abrir ticket
4. Verificar se mensagem aparece no chat
```

#### 5. Verificar WhatsApp do Cliente
```
Cliente deve receber:
✅ Mensagem no WhatsApp
✅ Texto correto
✅ Enviado pela empresa
```

---

## 📋 TESTE 2: Campanha com Imagem

### Passo a Passo:

#### 1. Criar Campanha
```
Menu: Campanhas → Nova Campanha

Configuração:
- Nome: "Teste API Oficial - Imagem"
- Conexão: [Selecionar API Oficial]
- Anexar: Selecionar imagem (JPG/PNG)
- Legenda: "Veja esta oferta especial!"
- Contatos: Selecionar 2-3 contatos
- Agendamento: Envio Imediato
```

#### 2. Iniciar Campanha
```
Clicar em "Iniciar Campanha"
```

#### 3. Verificar Logs
```
Backend deve mostrar:
✅ [SendMediaUnified] Enviando mídia para ticket X
✅ [SendMediaUnified] URL pública da mídia: https://...
✅ [OfficialAPI] Mensagem enviada: wamid.HBgN...
✅ [SendMediaUnified] Mensagem de mídia salva no banco
✅ [SendMediaUnified] Mídia enviada com sucesso
```

#### 4. Verificar Interface
```
1. Ir para aba "ATENDENDO" ou "BOT"
2. Abrir ticket criado pela campanha
3. Verificar:
   ✅ Imagem aparece no chat
   ✅ Legenda está correta
   ✅ Imagem não está quebrada (sem erro 404)
   ✅ Pode clicar e visualizar em tela cheia
```

#### 5. Verificar WhatsApp do Cliente
```
Cliente deve receber:
✅ Imagem no WhatsApp
✅ Legenda embaixo da imagem
✅ Qualidade boa da imagem
```

---

## 📋 TESTE 3: Campanha Agendada

### Passo a Passo:

#### 1. Criar Campanha Agendada
```
Menu: Campanhas → Nova Campanha

Configuração:
- Nome: "Teste API Oficial - Agendada"
- Conexão: [Selecionar API Oficial]
- Mensagem: "Mensagem agendada para teste"
- Contatos: Selecionar 2-3 contatos
- Agendamento: Escolher data/hora futura (ex: daqui 5 minutos)
```

#### 2. Aguardar Horário
```
Esperar até o horário agendado
```

#### 3. Verificar Envio Automático
```
No horário agendado, verificar logs:
✅ [Campaign] Iniciando campanha agendada ID=X
✅ [SendUnified] Enviando mensagem...
✅ [OfficialAPI] Mensagem enviada...
```

#### 4. Verificar Tickets
```
Após envio:
✅ Tickets criados
✅ Aparecem na interface
✅ Mensagens visíveis no chat
```

---

## 📋 TESTE 4: Campanha com Intervalo

### Passo a Passo:

#### 1. Criar Campanha com Intervalo
```
Menu: Campanhas → Nova Campanha

Configuração:
- Nome: "Teste API Oficial - Intervalo"
- Conexão: [Selecionar API Oficial]
- Mensagem: "Teste de intervalo entre envios"
- Contatos: Selecionar 10+ contatos
- Intervalo: 30 segundos entre mensagens
- Agendamento: Envio Imediato
```

#### 2. Monitorar Logs
```
Verificar que mensagens são enviadas com intervalo:

[00:00:00] Mensagem 1 enviada
[00:00:30] Mensagem 2 enviada  ← 30 segundos depois
[00:01:00] Mensagem 3 enviada  ← mais 30 segundos
[00:01:30] Mensagem 4 enviada  ← mais 30 segundos
```

#### 3. Verificar Status da Campanha
```
Interface:
✅ Mostra "Em andamento"
✅ Contador de mensagens enviadas aumentando
✅ Progresso: X/Y mensagens
```

---

## 📋 TESTE 5: Campanha com Diferentes Mídias

### Testar Cada Tipo:

#### Imagem (JPG/PNG)
```
✅ Upload: Imagem até 5MB
✅ Envio: API Oficial aceita
✅ Recebimento: Cliente recebe
✅ Interface: Aparece no chat
```

#### Vídeo (MP4)
```
✅ Upload: Vídeo até 16MB
✅ Envio: API Oficial aceita
✅ Recebimento: Cliente recebe
✅ Interface: Aparece com player no chat
```

#### Áudio (MP3/OGG)
```
✅ Upload: Áudio até 16MB
✅ Envio: API Oficial aceita
✅ Recebimento: Cliente recebe
✅ Interface: Aparece player de áudio
```

#### Documento (PDF)
```
✅ Upload: PDF até 100MB
✅ Envio: API Oficial aceita
✅ Recebimento: Cliente recebe
✅ Interface: Botão de download no chat
```

---

## 🔍 LOGS ESPERADOS

### Campanha Texto:
```bash
INFO: [Campaign] Iniciando campanha ID=123
INFO: [SendUnified] Enviando mensagem para ticket 456 (whatsappId=10)
INFO: [OfficialAPI] Mensagem enviada: wamid.HBgN5519992461008VCABEYEjA...
INFO: [SOCKET EMIT] event=company-1-appMessage ns=/workspace-1
INFO: [Campaign] Campanha 123: 1/5 mensagens enviadas
INFO: [Campaign] Campanha 123: 2/5 mensagens enviadas
...
INFO: [Campaign] Campanha 123 finalizada com sucesso
```

### Campanha Mídia:
```bash
INFO: [Campaign] Iniciando campanha ID=124
INFO: [SendMediaUnified] Enviando mídia para ticket 457
INFO: [SendMediaUnified] URL pública da mídia: https://seu-dominio.com/public/company1/arquivo.jpg
INFO: [OfficialAPI] Mensagem enviada: wamid.HBgN5519992461008VCABEYEjB...
INFO: [SendMediaUnified] Mensagem de mídia salva no banco: wamid.HBgN...
INFO: [SendMediaUnified] Mídia enviada com sucesso para ticket 457
INFO: [Campaign] Campanha 124: 1/5 mensagens enviadas
...
INFO: [Campaign] Campanha 124 finalizada com sucesso
```

---

## ⚠️ PROBLEMAS COMUNS

### Problema 1: Mensagens Não Enviam
```
Erro: "ERR_WAPP_NOT_INITIALIZED"

Solução:
1. Verificar se conexão está ativa
2. Verificar token da API Oficial
3. Verificar saldo/créditos na Meta
4. Reiniciar conexão
```

### Problema 2: Tickets Não Aparecem
```
Erro: Tickets criados mas não visíveis

Solução:
1. Verificar se status é "bot" (não "pending")
2. Limpar cache do navegador (Ctrl+F5)
3. Verificar aba 🤖 BOT
4. Verificar logs: FindOrCreateTicketService
```

### Problema 3: Imagens Quebradas
```
Erro: Imagens com erro 404

Solução:
1. Verificar se arquivo foi salvo em /public/company1/
2. Verificar URL no banco (mediaUrl)
3. Verificar permissões da pasta (chmod 777)
4. Verificar se backend salvou mensagem no banco
```

### Problema 4: Limite de Mensagens
```
Erro: "Rate limit exceeded"

Solução:
1. Aumentar intervalo entre mensagens (60+ segundos)
2. Verificar limites da Meta para sua conta
3. Usar tier superior da API Oficial
4. Dividir campanha em partes menores
```

---

## 📊 CHECKLIST DE TESTES

### Backend:
- [ ] `npm run build` sem erros
- [ ] Backend reiniciado
- [ ] Logs mostram envio de mensagens
- [ ] Logs mostram salvamento de mídias

### Campanhas Texto:
- [ ] Criação funciona
- [ ] Envio funciona
- [ ] Tickets criados
- [ ] Mensagens aparecem na interface
- [ ] Clientes recebem no WhatsApp

### Campanhas Mídia:
- [ ] Upload de imagem funciona
- [ ] Envio de imagem funciona
- [ ] Imagem aparece no chat (não quebrada)
- [ ] Upload de vídeo funciona
- [ ] Upload de áudio funciona
- [ ] Upload de documento funciona

### Interface:
- [ ] Aba BOT visível
- [ ] Tickets aparecem na aba BOT
- [ ] Badge mostra contagem correta
- [ ] Ao abrir ticket, mensagens visíveis
- [ ] Mídias carregam corretamente

### Status do Ticket:
- [ ] Novos tickets abrem com status "bot"
- [ ] Aparecem na aba 🤖 BOT
- [ ] Ao assumir, mudam para "open"
- [ ] Saem da aba BOT
- [ ] Vão para aba ATENDENDO

---

## 🎯 FLUXO COMPLETO ESPERADO

### 1. Criação da Campanha
```
Admin → Campanhas → Nova Campanha → Configurar → Salvar
```

### 2. Envio
```
Iniciar Campanha → Queue processa → SendUnified envia
```

### 3. Ticket Criado
```
API Oficial envia → Cliente recebe → (opcional) Cliente responde → 
Webhook recebe → FindOrCreateTicketService → Cria ticket com status "bot"
```

### 4. Interface Atualiza
```
Socket.IO emite evento → Frontend recebe → Aba BOT atualiza → 
Badge incrementa → Ticket aparece na lista
```

### 5. Atendente Assume
```
Atendente clica em ✓ → Status muda "bot" → "open" → 
Ticket sai da aba BOT → Vai para aba ATENDENDO
```

---

## 🔧 COMANDOS ÚTEIS

### Compilar Backend:
```bash
cd backend
npm run build
```

### Verificar Logs em Tempo Real:
```bash
# Linux/Mac
tail -f backend/logs/app.log

# Windows PowerShell
Get-Content backend/logs/app.log -Wait -Tail 50
```

### Verificar Tickets no Banco:
```sql
-- Tickets criados nas últimas 24h
SELECT id, status, "contactId", "isBot", "createdAt" 
FROM "Tickets" 
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
ORDER BY id DESC 
LIMIT 20;

-- Tickets com status "bot"
SELECT id, status, "contactId", "isBot", "lastMessage"
FROM "Tickets"
WHERE status = 'bot'
ORDER BY id DESC;
```

### Verificar Mensagens de Mídia:
```sql
-- Mensagens de mídia enviadas
SELECT id, "ticketId", "fromMe", "mediaType", "mediaUrl", "createdAt"
FROM "Messages"
WHERE "fromMe" = true 
  AND "mediaType" IN ('image', 'video', 'audio', 'document')
ORDER BY id DESC
LIMIT 10;
```

---

## 📈 MÉTRICAS DE SUCESSO

### Taxa de Envio:
```
✅ 100% das mensagens enviadas
✅ 0% de erros
✅ Tempo médio: <2 segundos por mensagem
```

### Taxa de Entrega:
```
✅ 100% entregues (ack=2)
✅ 90%+ lidas (ack=3)
✅ Taxa de resposta: variável
```

### Performance:
```
✅ Tickets criados instantaneamente
✅ Interface atualiza em <1 segundo
✅ Mídias carregam em <3 segundos
```

---

## 🆘 SUPORTE

### Se algo não funcionar:

1. **Verificar Logs do Backend**
   - Procurar por erros (ERROR, WARN)
   - Verificar se mensagens foram enviadas
   - Verificar se tickets foram criados

2. **Verificar Console do Navegador (F12)**
   - Procurar erros JavaScript
   - Verificar requisições de API
   - Verificar eventos Socket.IO

3. **Verificar Banco de Dados**
   - Tickets criados?
   - Mensagens salvas?
   - mediaUrl correto?

4. **Verificar Arquivos**
   - Arquivos existem em /public/company1/?
   - Permissões corretas (777)?
   - Tamanho adequado?

---

## ✅ RESULTADO ESPERADO

Após todas as correções e testes:

### Backend:
✅ Compila sem erros
✅ Mídias são salvas no banco
✅ Tickets criados com status "bot"
✅ Logs claros e informativos

### Frontend:
✅ Aba BOT visível
✅ Tickets aparecem corretamente
✅ Mídias carregam sem erro
✅ Interface responsiva

### Campanhas:
✅ Texto funciona perfeitamente
✅ Imagens funcionam perfeitamente
✅ Vídeos funcionam perfeitamente
✅ Áudios funcionam perfeitamente
✅ Documentos funcionam perfeitamente

### Experiência:
✅ Igual ao Baileys
✅ Tudo visível na interface
✅ Sem quebras de imagem
✅ Performance excelente

---

**BOA SORTE COM OS TESTES!** 🚀🎉
