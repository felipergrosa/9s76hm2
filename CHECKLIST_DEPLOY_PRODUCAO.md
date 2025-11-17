# ✅ Checklist de Deploy - Produção

## 🎯 Status Atual

**Data:** 17/11/2024  
**Hora:** 12:40  
**Status:** ✅ Código 100% pronto  
**Próximo Passo:** Deploy e testes

---

## 📦 Arquivos Prontos para Deploy

### Backend (Necessário Rebuild)
- [x] ✅ `WhatsAppController.ts` - Atualizado
- [x] ✅ `MessageController.ts` - Atualizado  
- [x] ✅ `SendWhatsAppMessageUnified.ts` - Criado
- [x] ✅ `SendWhatsAppMediaUnified.ts` - Criado  
- [x] ✅ `DeleteWhatsAppMessageUnified.ts` - Criado
- [x] ✅ `StartWhatsAppSessionUnified.ts` - Já existia
- [x] ✅ `IWhatsAppAdapter.ts` - Atualizado (deleteMessage, editMessage, filename)
- [x] ✅ `BaileysAdapter.ts` - Atualizado (deleteMessage, editMessage)
- [x] ✅ `OfficialAPIAdapter.ts` - Atualizado (deleteMessage, editMessage)

### Frontend (Necessário Rebuild)
- [x] ✅ `OfficialAPIFields.js` - Callback URL corrigida
- [x] ✅ Build concluído (linha de comando)

---

## 🚀 Passo a Passo de Deploy

### FASE 1: Commit e Push (5 min)

```bash
# 1. Ver mudanças
git status

# 2. Adicionar tudo
git add .

# 3. Commit descritivo
git commit -m "feat: implementação completa API Oficial WhatsApp

- Adicionar SendWhatsAppMediaUnified (envio mídia)
- Adicionar DeleteWhatsAppMessageUnified (deletar msg)
- Atualizar MessageController para usar versões unificadas
- Corrigir callback URL no OfficialAPIFields
- Adicionar métodos deleteMessage e editMessage nos adapters
- Atualizar interface IWhatsAppAdapter

Ref: Suporte completo Baileys + API Oficial Meta"

# 4. Push
git push origin main
```

---

### FASE 2: Build Imagens Docker (10 min)

#### Backend

```bash
cd backend

# Build
docker build -t felipergrosa/whaticket-backend:latest .

# Tag com versão (opcional)
docker tag felipergrosa/whaticket-backend:latest \
  felipergrosa/whaticket-backend:2.0-api-oficial

# Push
docker push felipergrosa/whaticket-backend:latest
docker push felipergrosa/whaticket-backend:2.0-api-oficial
```

**Tamanho esperado:** ~800MB-1.2GB

#### Frontend

```bash
cd frontend

# Build
docker build -t felipergrosa/whaticket-frontend:latest .

# Tag com versão (opcional)
docker tag felipergrosa/whaticket-frontend:latest \
  felipergrosa/whaticket-frontend:2.0-api-oficial

# Push
docker push felipergrosa/whaticket-frontend:latest
docker push felipergrosa/whaticket-frontend:2.0-api-oficial
```

**Tamanho esperado:** ~200-400MB

---

### FASE 3: Update Stack Portainer (3 min)

#### Opção A: Via Interface Web (Mais Fácil)

```
1. Acessar Portainer
   https://seu-portainer.com

2. Stacks → nobreluminarias (ou nome da sua stack)

3. Clicar em "Editor"

4. Verificar se tem as variáveis:
   WABA_WEBHOOK_VERIFY_TOKEN: 602536nblumi2025
   WABA_API_VERSION: v18.0

5. Clicar "Update the stack"

6. ✅ Marcar "Re-pull image and redeploy"

7. Clicar "Update"

8. Aguardar 2-3 minutos
```

#### Opção B: Via Portainer API (Avançado)

```bash
# Obter token de autenticação
TOKEN=$(curl -X POST 'https://seu-portainer.com/api/auth' \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"suasenha"}' \
  | jq -r '.jwt')

# Update stack
curl -X PUT "https://seu-portainer.com/api/stacks/STACK_ID?endpointId=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prune": true,
    "pullImage": true
  }'
```

---

### FASE 4: Verificar Logs (2 min)

```bash
# SSH no servidor
ssh usuario@seu-servidor

# Ver logs backend
docker service logs nobreluminarias_whaticketback --tail 100 -f

# Procurar por:
# ✅ "Server started on port 8080"
# ✅ "Connected to database"
# ✅ "[OfficialAPIAdapter] Initialized successfully"
# ❌ Erros de TypeScript
# ❌ Module not found

# Ver logs frontend
docker service logs nobreluminarias_whaticketfront --tail 50

# Ctrl+C para sair dos logs
```

---

### FASE 5: Testes Funcionais (15 min)

#### Teste 1: Baileys (Garantir Sem Regressão)

```
1. Abrir Whaticket
   https://chats.nobreluminarias.com.br

2. Conexões → Selecionar conexão Baileys

3. Status: CONECTADO? ✅

4. Abrir ticket de teste

5. Enviar mensagem:
   "Teste pós-deploy Baileys"

6. ✅ Deve enviar normalmente
7. ✅ Status deve atualizar (✓✓)
8. ✅ Mensagem deve chegar no WhatsApp
```

**Se falhar:** Rollback imediatamente!

---

#### Teste 2: API Oficial - Texto

```
1. Conexões → Conexão API Oficial

2. Status: CONECTADO? ✅

3. Abrir ticket de teste

4. Enviar mensagem:
   "🎉 Teste API Oficial - Envio Texto"

5. ✅ Deve enviar sem erros
6. ✅ Status deve atualizar (✓✓)
7. ✅ Mensagem deve chegar no WhatsApp
```

**Se erro "sessão não inicializada":**
- Verificar logs
- Restart serviço backend

---

#### Teste 3: API Oficial - Imagem

```
1. Mesma conversa do teste anterior

2. Clicar em 📎 (anexar)

3. Selecionar uma imagem (< 5MB)

4. Adicionar legenda:
   "🖼️ Teste de envio de imagem via API Oficial"

5. Enviar

6. ✅ Deve enviar sem erros
7. ✅ Imagem deve aparecer no chat
8. ✅ Imagem deve chegar no WhatsApp
```

**Se falhar:**
- Verificar URL pública acessível
- Verificar BACKEND_URL configurado
- Ver logs: "SendMediaUnified"

---

#### Teste 4: API Oficial - Recebimento

```
1. No celular (WhatsApp):
   Enviar mensagem para número da API Oficial
   "📲 Teste de recebimento"

2. No Whaticket:
   
   ✅ Mensagem deve aparecer
   ✅ Ticket deve ser criado (se não existir)
   ✅ Notificação deve aparecer
   ✅ Badge de mensagem nova
```

**Se não receber:**
- Verificar webhook configurado
- Verificar eventos subscritos
- Ver Meta "Recent Deliveries"
- Verificar logs webhook

---

#### Teste 5: Deletar Mensagem

```
1. Enviar mensagem qualquer

2. Hover sobre mensagem

3. Clicar ⋮ (três pontos) → Deletar

4. ✅ Mensagem deve ser deletada
5. ✅ Deve aparecer "Mensagem apagada"

OBS: API Oficial só permite até 24h!
```

---

## 📊 Checklist Pós-Deploy

### Verificações Técnicas

- [ ] Backend rodando sem erros
- [ ] Frontend acessível
- [ ] Banco de dados conectado
- [ ] Redis funcionando
- [ ] Logs sem erros críticos
- [ ] Memória/CPU OK
- [ ] SSL/HTTPS funcionando

### Funcionalidades Baileys

- [ ] Criar conexão Baileys
- [ ] QR Code aparece
- [ ] Conecta após escanear
- [ ] Enviar texto
- [ ] Enviar imagem
- [ ] Receber mensagem
- [ ] Status atualiza

### Funcionalidades API Oficial

- [ ] Criar conexão API Oficial
- [ ] NÃO aparece QR Code ✅
- [ ] Conecta automaticamente
- [ ] Enviar texto
- [ ] Enviar imagem
- [ ] Receber mensagem (webhook)
- [ ] Status atualiza
- [ ] Deletar mensagem (< 24h)

### Interface

- [ ] Seletor de canal funciona
- [ ] Campos condicionais aparecem
- [ ] Callback URL correta (chatsapi)
- [ ] Badge identificador OK
- [ ] Tutorial acessível

---

## 🐛 Problemas Comuns e Soluções

### Problema 1: Imagem não mostra erro 404

**Causa:** Arquivo não acessível publicamente

**Solução:**
```bash
# Verificar permissões da pasta
ls -la /opt/whaticket-data/public/company1/

# Corrigir permissões
chmod -R 755 /opt/whaticket-data/public/
```

---

### Problema 2: Backend não inicia

**Causa:** Erro de build ou módulo faltando

**Solução:**
```bash
# Ver logs completos
docker service logs nobreluminarias_whaticketback --tail 200

# Restart forçado
docker service update --force nobreluminarias_whaticketback

# Se persistir, rollback
docker service update --image \
  felipergrosa/whaticket-backend:VERSAO_ANTIGA \
  nobreluminarias_whaticketback
```

---

### Problema 3: Webhook não recebe

**Causa:** URL errada ou eventos não subscritos

**Solução:**
```bash
# Testar webhook manualmente
curl -X GET "https://chatsapi.nobreluminarias.com.br/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=602536nblumi2025&hub.challenge=TEST"

# Deve retornar: TEST

# Se retornar 404, rota não existe
# Se retornar erro, ver logs backend
```

**Na Meta:**
1. Webhooks → Edit subscription
2. Verificar eventos marcados:
   - ✅ messages
   - ✅ message_status
3. Resubscrever se necessário

---

### Problema 4: Erro ao enviar mídia API Oficial

**Erro:** "Invalid media URL"

**Causa:** URL não é pública ou não acessível

**Solução:**
```bash
# Testar URL
curl -I https://chatsapi.nobreluminarias.com.br/public/company1/file.jpg

# Deve retornar 200 OK

# Se 403/404:
# 1. Verificar Nginx/Traefik config
# 2. Verificar pasta /public exposta
# 3. Verificar BACKEND_URL está correto
```

---

## 🔄 Rollback (Se Necessário)

Se algo der muito errado:

```bash
# SSH no servidor
ssh usuario@servidor

# Rollback backend
docker service update --image \
  felipergrosa/whaticket-backend:ULTIMA_VERSAO_BOA \
  nobreluminarias_whaticketback

# Rollback frontend
docker service update --image \
  felipergrosa/whaticket-frontend:ULTIMA_VERSAO_BOA \
  nobreluminarias_whaticketfront

# Aguardar 2 minutos
# Verificar se voltou ao normal
```

---

## 📈 Monitoramento Pós-Deploy

### Primeiras 24h

```bash
# Ver logs em tempo real
docker service logs nobreluminarias_whaticketback -f

# Monitorar uso de memória
docker stats

# Verificar conexões
SELECT count(*) FROM "Whatsapps" WHERE "channelType" = 'official';
```

### Primeiros 7 dias

- [ ] Verificar custos Meta (se usando API Oficial)
- [ ] Monitorar erros no Sentry (se configurado)
- [ ] Verificar quality rating na Meta
- [ ] Coletar feedback dos usuários
- [ ] Ajustar limites se necessário

---

## 💰 Custos Esperados (API Oficial)

### Brasil (Meta Pricing)

| Tipo | Conversas/mês | Custo Unitário | Total/mês |
|------|---------------|----------------|-----------|
| Service (empresa→cliente) | 1.000 | R$ 0,50 | R$ 500 |
| Marketing | 1.000 | R$ 0,85 | R$ 850 |
| Utility (notificações) | 1.000 | R$ 0,30 | R$ 300 |

**Total estimado para 1.000 conversas:** R$ 500-850/mês

**Dica:** Primeiras 1.000 conversas/mês são grátis!

---

## 📞 Suporte e Contatos

### Em Caso de Problemas

1. **Verificar documentação:**
   - `IMPLEMENTACAO_COMPLETA_API_OFICIAL.md`
   - `TUTORIAL_INTEGRACAO_META_COMPLETO.md`

2. **Ver logs:**
   ```bash
   docker service logs nobreluminarias_whaticketback -f
   ```

3. **Testar componentes:**
   - Backend health: `curl https://chatsapi.../health`
   - Frontend: `curl -I https://chats...`
   - Webhook: `curl https://chatsapi.../webhooks/whatsapp`

4. **Criar issue no GitHub** (se open source)

---

## ✅ Checklist Final

Antes de dar como concluído:

- [ ] ✅ Deploy realizado sem erros
- [ ] ✅ Logs OK (sem erros críticos)
- [ ] ✅ Baileys funcionando (sem regressão)
- [ ] ✅ API Oficial funcionando
- [ ] ✅ Envio texto OK
- [ ] ✅ Envio mídia OK
- [ ] ✅ Recebimento OK
- [ ] ✅ Status atualiza OK
- [ ] ✅ Interface OK
- [ ] ✅ Webhook configurado
- [ ] ✅ Documentação atualizada
- [ ] ✅ Equipe informada
- [ ] ✅ Backup realizado
- [ ] ✅ Monitoramento ativo

---

## 🎉 Conclusão

**Quando tudo estiver ✅:**

```
🎊 DEPLOY CONCLUÍDO COM SUCESSO! 🎊

Whaticket agora suporta:
✅ Baileys (Gratuito)
✅ WhatsApp Business API Oficial (Meta)

Sistema pronto para uso em produção!
```

---

**Boa sorte com o deploy! 🚀**

*Se precisar de ajuda, consulte a documentação completa.*

---

*Checklist criado em: 17/11/2024 às 12:45*  
*Versão: 1.0*  
*Status: ✅ Pronto para uso*
