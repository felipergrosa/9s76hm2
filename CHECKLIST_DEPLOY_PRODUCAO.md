# 🚀 CHECKLIST DE IMPLANTAÇÃO EM PRODUÇÃO

## ⚠️ **ANTES DE COMEÇAR**

### 1. **Backup Completo**
```bash
# Backup do banco de dados
pg_dump whaticket > backup_antes_melhorias_$(date +%Y%m%d_%H%M%S).sql

# Backup do código atual
git tag backup-antes-melhorias-$(date +%Y%m%d)
git push origin --tags
```

### 2. **Testar em Homologação**
```bash
# Criar branch de homologação
git checkout -b homologacao-melhorias main
git merge feature/safe-extractions-from-recovery

# Deploy em ambiente de homologação
# Testar todas as funcionalidades
```

## 📦 **PASSO 1: ATUALIZAÇÃO DE DEPENDÊNCIAS**

### Backend
```bash
cd backend
npm install
npm audit fix  # Corrigir vulnerabilidades se houver

# Verificar se tudo compila
npm run build
```

### Frontend (se necessário)
```bash
cd frontend
npm install
npm run build
```

## 📝 **PASSO 2: CONFIGURAR VARIÁVEES DE AMBIENTE**

Adicionar ao .env de produção:
```env
# Controle de sessão pronta (RECOMENDADO ATIVAR)
ENABLE_SESSION_READY_CONTROL=true

# Logs detalhados (APENAS SE PRECISAR DEBUG)
ENABLE_DETAILED_LOGS=false

# Store persistente (EXPERIMENTAL - MANTER DESLIGADO)
ENABLE_PERSISTENT_STORE=false
```

## 🔧 **PASSO 3: APLICAÇÃO DAS MIGRATIONS**

```bash
cd backend
npx sequelize db:migrate

# Verificar status
npx sequelize db:migrate:status
```

## 🚀 **PASSO 4: DEPLOY GRADUAL**

### 4.1. **Atualizar Backend**
```bash
# Build da imagem
docker build -t whaticket-backend:new ./backend

# Parar backend atual
docker stop whaticket-backend

# Subir nova versão
docker-compose up -d backend

# Verificar logs
docker logs -f whaticket-backend
```

### 4.2. **Verificar Funcionamento**
- [ ] Backend sobe sem erros
- [ ] Conexões WhatsApp estabelecem
- [ ] Mensagens chegam normalmente
- [ ] Não há erros nos logs

### 4.3. **Atualizar Frontend**
```bash
# Se necessário
docker-compose up -d frontend
```

## 🔍 **PASSO 5: MONITORAMENTO PÓS-DEPLOY**

### Logs Críticos para Monitorar
```bash
# Verificar SignalErrorHandler
docker logs whaticket-backend | grep "SignalError"

# Verificar sessões prontas
docker logs whaticket-backend | grep "SessionReady"

# Verificar mensagens recebidas
docker logs whaticket-backend | grep "MessageDebug"

# Verificar erros gerais
docker logs whaticket-backend | grep "ERROR"
```

### Métricas para Observar
- [ ] Número de desconexões (deve diminuir)
- [ ] Tempo de processamento de mensagens
- [ ] Uso de memória (store persistente pode aumentar)
- [ ] Taxa de sucesso no envio de mensagens

## ⚡ **PASSO 6: ATIVAÇÃO DE FEATURES (OPCIONAL)**

Se tudo estiver funcionando bem, pode ativar features extras:

### Ativar Logs Detalhados (se precisar debug)
```env
ENABLE_DETAILED_LOGS=true
```
Reiniciar backend após mudança.

### Ativar Store Persistente (experimental)
```env
ENABLE_PERSISTENT_STORE=true
```
**CUIDADO**: Isso aumentará o uso de disco!

## 🔄 **PASSO 7: ROLLBACK SE NECESSÁRIO**

Se algo der errado:

### Rollback Rápido
```bash
# Voltar para backup
git checkout backup-antes-melhorias-YYYYMMDD

# Fazer deploy da versão anterior
docker-compose up -d --build
```

### Rollback de Features
```bash
# Desativar todas as features no .env
ENABLE_SESSION_READY_CONTROL=false
ENABLE_DETAILED_LOGS=false
ENABLE_PERSISTENT_STORE=false

# Reiniciar backend
docker restart whaticket-backend
```

## 📊 **PASSO 8: VALIDAÇÃO FINAL**

### Testes Funcionais
- [ ] Enviar mensagem do WhatsApp → aparece no Whaticket
- [ ] Enviar mensagem do Whaticket → chega no WhatsApp
- [ ] Criar novo contato → campo segment funciona
- [ ] Filtrar contatos → lazy loading funciona
- [ ] Upload de mídia → volumes persistentes funcionam

### Testes de Estresse
- [ ] Múltiplas conexões simultâneas
- [ ] Envio em massa de mensagens
- [ ] Reinício do serviço

## 🎯 **SINAIS DE SUCESSO**

✅ **Indicadores Positivos**:
- Menos logs de "DESCONECTOU"
- Mensagens não somem mais
- Performance melhorada
- Sem crashes no backend

❌ **Indicadores de Problema**:
- Muitos erros SignalError
- Mensagens não chegam
- Alto uso de CPU/memória
- Conexões não estabelecem

## 📞 **SUPORTE**

Se encontrar problemas:
1. Verificar os logs específicos
2. Desativar features uma por uma
3. Fazer rollback se necessário
4. Abrir issue com detalhes

---

## ⚠️ **IMPORTANTE**

- **NUNCA ative todas as features de uma vez**
- **MONITORE constantemente após o deploy**
- **TENHA sempre um backup recente**
- **TESTE em homologação antes da produção**
