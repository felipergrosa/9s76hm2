# Checklist de Testes - Migração Baileys v7

## ✅ Mudanças Aplicadas

### 1. Package.json
- ✅ Baileys atualizado: `6.17.16` → `^7.1.1`

### 2. Imports Corrigidos
- ✅ `delay` removido de imports do Baileys (não existe mais na v7)
- ✅ Implementação própria de `delay` adicionada em 5 arquivos:
  - `SendWhatsAppMessageLink.ts`
  - `SendWhatsAppMessageAPI.ts`
  - `SendWhatsappMediaImage.ts`
  - `typebotListener.ts`
  - `queues.ts`

### 3. Código Já Compatível (não precisou mudança)
- ✅ `authState.ts` - já usa estrutura compatível com v7
- ✅ `wbot.ts` - já usa `makeCacheableSignalKeyStore`
- ✅ `useMultiFileAuthState` - implementação customizada compatível
- ✅ `ContactResolverService.ts` - USyncQuery pronto para funcionar
- ✅ `StartWhatsAppSessionUnified.ts` - evento `lid-mapping.update` registrado

---

## 🔧 Próximos Passos

### PASSO 1: Instalar Dependências
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

**Tempo estimado:** 2-5 minutos  
**O que esperar:** Download do Baileys v7.1.1 e dependências

---

### PASSO 2: Compilar TypeScript
```bash
npm run build
```

**Tempo estimado:** 30-60 segundos  
**O que esperar:** 
- ✅ Compilação sem erros
- ⚠️ Possíveis warnings de tipos (normal na migração)

**Se houver erros:**
- Verificar se todos os imports estão corretos
- Verificar se tipos do Baileys mudaram

---

### PASSO 3: Parar Backend Atual
```bash
# Se estiver rodando com PM2
pm2 stop backend

# Se estiver rodando com npm
# Ctrl+C no terminal
```

---

### PASSO 4: Limpar Sessões (OPCIONAL - mas recomendado)
```bash
# Backup das sessões atuais
cp -r .wwebjs_auth .wwebjs_auth.backup_v6

# OPCIONAL: Limpar sessões para forçar re-pairing
# rm -rf .wwebjs_auth/session-*
```

**⚠️ ATENÇÃO:** Se limpar as sessões, precisará escanear QR code novamente!

---

### PASSO 5: Iniciar Backend
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

**Tempo estimado:** 30-60 segundos para inicializar

---

## 🧪 Testes Obrigatórios

### Teste 1: Conexão Inicial
- [ ] Backend inicia sem erros
- [ ] Logs mostram versão do Baileys v7.x
- [ ] QR code é gerado (se sessão nova)
- [ ] Conexão estabelecida (status: CONNECTED)

**Como verificar:**
```bash
# Verificar logs
tail -f backend/logs/app.log | grep -i baileys

# Deve aparecer algo como:
# Baileys pkg v7.1.1 | WA Web v2.3000.x
```

---

### Teste 2: Recebimento de Mensagens
- [ ] Enviar mensagem de texto para o WhatsApp
- [ ] Mensagem aparece no frontend
- [ ] Contato é criado/atualizado corretamente
- [ ] Ticket é criado

**Como testar:**
1. Enviar mensagem de outro WhatsApp
2. Verificar se aparece no Whaticket
3. Verificar logs: `[handleMessage]`

---

### Teste 3: Envio de Mensagens
- [ ] Enviar mensagem de texto do Whaticket
- [ ] Mensagem é recebida no WhatsApp
- [ ] Status de entrega atualiza

**Como testar:**
1. Abrir ticket no Whaticket
2. Enviar mensagem
3. Verificar recebimento no WhatsApp

---

### Teste 4: Mensagens de Mídia
- [ ] Receber imagem
- [ ] Receber vídeo
- [ ] Receber áudio
- [ ] Receber documento
- [ ] Enviar imagem
- [ ] Enviar vídeo
- [ ] Enviar áudio
- [ ] Enviar documento

**Como testar:**
1. Enviar cada tipo de mídia para o WhatsApp
2. Verificar se aparece corretamente no frontend
3. Verificar se download funciona

---

### Teste 5: Mensagens de Grupo
- [ ] Receber mensagem de grupo
- [ ] Participantes aparecem corretamente
- [ ] Enviar mensagem para grupo

**Como testar:**
1. Enviar mensagem em grupo
2. Verificar se aparece no Whaticket
3. Verificar se nome do participante está correto

---

### Teste 6: **CRÍTICO - Resolução de LID** 🎯
Este é o principal benefício da v7!

- [ ] Receber mensagem de contato LID
- [ ] Verificar logs: `[resolveLidToPN]`
- [ ] Verificar se USyncQuery foi executado
- [ ] Verificar se número foi resolvido
- [ ] Contato criado com número correto (não LID)
- [ ] Evento `lid-mapping.update` disparado

**Como testar:**
1. Enviar mensagem de contato que não está na agenda
2. Verificar logs:
```bash
tail -f backend/logs/app.log | grep -i "usync\|lid-mapping"

# Deve aparecer:
# [resolveLidToPN] USync retornou dados
# [resolveLidToPN] LID resolvido via USync!
# [lid-mapping.update] Mapeamento persistido: 3810206466207@lid → +554138911718
```

3. Verificar no banco:
```sql
SELECT * FROM "LidMappings" ORDER BY "createdAt" DESC LIMIT 10;
```

4. Verificar contato criado:
```sql
SELECT id, name, number, "lidJid", "remoteJid" 
FROM "Contacts" 
WHERE "lidJid" IS NOT NULL 
ORDER BY "createdAt" DESC LIMIT 10;
```

**✅ Sucesso:** Número aparece como `+554138911718` (não `3810206466207`)  
**❌ Falha:** Número aparece como LID ou `PENDING_`

---

### Teste 7: Reconexão Automática
- [ ] Desconectar WhatsApp (modo avião no celular)
- [ ] Aguardar 30 segundos
- [ ] Reconectar (desligar modo avião)
- [ ] Verificar se reconecta automaticamente

**Como verificar:**
```bash
tail -f backend/logs/app.log | grep -i "connection.update"
```

---

### Teste 8: Mensagens de Template/Botões
- [ ] Receber `templateButtonReplyMessage`
- [ ] Receber `listResponseMessage`
- [ ] Receber `buttonsResponseMessage`

**Como testar:**
1. Enviar mensagem com botões do WhatsApp Business
2. Verificar se aparece no frontend

---

### Teste 9: Edição e Deleção
- [ ] Editar mensagem enviada
- [ ] Deletar mensagem enviada
- [ ] Receber mensagem editada
- [ ] Receber mensagem deletada

---

### Teste 10: Performance e Estabilidade
- [ ] Sistema roda por 1 hora sem crashes
- [ ] Memória não cresce indefinidamente
- [ ] CPU não fica em 100%

**Como verificar:**
```bash
# Monitorar recursos
top -p $(pgrep -f "node.*server")

# Verificar memória
ps aux | grep node | grep -v grep
```

---

## 🚨 Problemas Conhecidos e Soluções

### Problema 1: "Cannot find module '@whiskeysockets/baileys'"
**Solução:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Problema 2: Sessão não conecta (QR code não aparece)
**Solução:**
```bash
# Limpar sessão e tentar novamente
rm -rf .wwebjs_auth/session-{ID}
# Reiniciar backend
```

### Problema 3: USyncQuery não funciona
**Verificar:**
- Baileys está realmente na v7? `npm list @whiskeysockets/baileys`
- Logs mostram tentativa de USync? `grep -i usync logs/app.log`

### Problema 4: Erros de tipo TypeScript
**Solução:**
```bash
# Limpar build anterior
rm -rf dist/
npm run build
```

### Problema 5: LID ainda não resolve
**Verificar:**
1. Contato está na agenda do celular?
2. Evento `lid-mapping.update` está registrado?
3. Logs mostram tentativa de resolução?

**Debug:**
```bash
# Ativar logs detalhados
export LOG_LEVEL=debug
npm run dev
```

---

## 📊 Métricas de Sucesso

### Antes da Migração (v6.17.16)
- ❌ LIDs não resolvem consistentemente
- ❌ USyncQuery não funciona
- ⚠️ Contatos criados com número LID

### Depois da Migração (v7.1.1)
- ✅ LIDs resolvem via USyncQuery
- ✅ Evento `lid-mapping.update` funciona
- ✅ Contatos criados com número real
- ✅ Menos contatos duplicados
- ✅ Melhor estabilidade de conexão

---

## 🔄 Rollback (se necessário)

Se algo der muito errado:

```bash
# 1. Parar backend
pm2 stop backend

# 2. Reverter package.json
cd backend
git checkout package.json

# 3. Reverter código
git checkout src/services/WbotServices/SendWhatsAppMessageLink.ts
git checkout src/services/WbotServices/SendWhatsAppMessageAPI.ts
git checkout src/services/WbotServices/SendWhatsappMediaImage.ts
git checkout src/services/TypebotServices/typebotListener.ts
git checkout src/queues.ts

# 4. Reinstalar v6
rm -rf node_modules package-lock.json
npm install

# 5. Restaurar sessões (se fez backup)
rm -rf .wwebjs_auth
cp -r .wwebjs_auth.backup_v6 .wwebjs_auth

# 6. Recompilar e reiniciar
npm run build
pm2 start backend
```

---

## 📝 Notas Importantes

1. **Primeira conexão pode demorar mais** - Baileys v7 faz sync completo
2. **Alguns contatos podem precisar de QR novamente** - Normal na migração
3. **LID resolution não é 100%** - Depende do WhatsApp fornecer o mapeamento
4. **Monitore logs nas primeiras horas** - Identificar problemas cedo

---

## ✅ Checklist Final

Antes de considerar a migração completa:

- [ ] Todos os testes passaram
- [ ] Nenhum erro crítico nos logs
- [ ] LID resolution funcionando (pelo menos 1 caso testado)
- [ ] Sistema estável por 2+ horas
- [ ] Backup das sessões antigas mantido
- [ ] Documentação atualizada

---

**Data da migração:** ___________  
**Responsável:** ___________  
**Status:** ⬜ Em andamento | ⬜ Concluída | ⬜ Rollback necessário
