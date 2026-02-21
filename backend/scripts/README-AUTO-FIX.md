# 🚀 AUTOMAÇÃO PARA PRODUÇÃO - DETECTAR E CORRIGIR SESSÕES CORROMPIDAS

## 📋 SCRIPTS CRIADOS

### 1. **Script Principal** - `auto-fix-sessions.js`
Detecta e corrige automaticamente sessões WhatsApp corrompidas.

### 2. **Monitor Contínuo** - `production-monitor.js`
Cron job que verifica a cada 10 minutos.

### 3. **Script Shell** - `auto-fix-sessions.sh`
Versão bash para ambientes Linux/Production.

## 🛠️ INSTALAÇÃO E CONFIGURAÇÃO

### 1. Adicionar dependências:
```bash
cd backend
npm install node-cron axios
```

### 2. Criar diretório de logs:
```bash
mkdir -p logs
```

### 3. Permissões (Linux):
```bash
chmod +x scripts/auto-fix-sessions.sh
```

## 🚀 USO EM PRODUÇÃO

### Opção 1: Monitor Contínuo (Recomendado)
```bash
# Iniciar monitor automático
node scripts/production-monitor.js

# Ou com PM2
pm2 start scripts/production-monitor.js --name "session-monitor"
```

### Opção 2: Verificação Manual
```bash
# Verificar todas as sessões
node scripts/auto-fix-sessions.js all

# Verificar sessão específica
node scripts/auto-fix-sessions.js 26
```

### Opção 3: Script Shell (Linux)
```bash
# Verificar todas
./scripts/auto-fix-sessions.sh all

# Verificar específica
./scripts/auto-fix-sessions.sh 26
```

## 📊 COMO FUNCIONA

### Detecção Automática:
1. **Monitora logs** por erros típicos:
   - `Invalid PreKey ID`
   - `Bad MAC Error`
   - `PreKeyError`
   - `failed to decrypt message`

2. **Threshold**: Mais de 5 erros em 5 minutos = sessão corrompida

3. **Ação Automática**:
   - Desconecta via API
   - Remove arquivos de sessão
   - Limpa cache Redis
   - Reconecta automaticamente

### Logs:
- Todos os eventos são logados em `logs/auto-fix-sessions.log`
- Formato: `[timestamp] mensagem`

## 🔧 CONFIGURAÇÃO

### Variáveis de Ambiente:
```bash
BACKEND_URL=http://localhost:8080
REDIS_URL=redis://127.0.0.1:6379/0
```

### Customização:
- Editar `THRESHOLD_ERRORS` no script (padrão: 5)
- Editar `CHECK_INTERVAL` no cron (padrão: 10 minutos)

## 🚨 INTEGRAÇÃO COM DOCKER

### Adicionar ao docker-compose.yml:
```yaml
backend:
  # ... configuração existente
  volumes:
    - ./backend/logs:/app/logs
    - ./backend/scripts:/app/scripts
  environment:
    - NODE_ENV=production
    - BACKEND_URL=http://localhost:8080
    - REDIS_URL=redis://redis:6379/0
```

### Dockerfile:
```dockerfile
# Adicionar após instalação de dependências
COPY scripts/ /app/scripts/
RUN chmod +x /app/scripts/*.sh

# Iniciar monitor automático
CMD ["node", "scripts/production-monitor.js"]
```

## 📱 ENDPOINTS DA API

O script usa os seguintes endpoints (devem existir):
- `PUT /whatsapp/:id/disconnect` - Desconectar sessão
- `PUT /whatsapp/:id/start-session` - Iniciar sessão
- `GET /whatsapp` - Listar sessões
- `GET /health` - Verificar saúde do backend

## 🎯 BENEFÍCIOS

### ✅ Automático:
- Detecta problemas sem intervenção manual
- Corrige automaticamente sessões corrompidas
- Mantém o sistema funcionando 24/7

### ✅ Monitoramento:
- Logs detalhados de todas as ações
- Threshold configurável
- Verificação em intervalos regulares

### ✅ Seguro:
- Não afeta outras sessões
- Backup automático antes de resetar
- Verificação de saúde do sistema

## 🔍 MONITORAMENTO

### Verificar status:
```bash
# Verificar logs
tail -f logs/auto-fix-sessions.log

# Verificar se está rodando
pm2 list | grep session-monitor
```

### Estatísticas:
- Total de sessões verificadas
- Sessões corrigidas automaticamente
- Tempo médio de correção

## 🚨 EMERGÊNCIA

### Parar monitor:
```bash
pm2 stop session-monitor
# ou
pkill -f production-monitor
```

### Reset manual completo:
```bash
node scripts/auto-fix-sessions.js all
```

## 📞 SUPORTE

Em caso de problemas:
1. Verificar logs em `logs/auto-fix-sessions.log`
2. Verificar se backend está online
3. Verificar conexão com Redis
4. Executar manualmente para debug

---

**Status**: ✅ Pronto para produção
**Testado**: ✅ Simulação completa
**Documentação**: ✅ Completa
