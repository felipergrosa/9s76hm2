# 🚀 COMANDOS PARA DEPLOY EM PRODUÇÃO

## 1. COPIAR SCRIPTS PARA PRODUÇÃO
```bash
# Copiar scripts para o servidor
scp backend/scripts/smart-guardian.js user@servidor:/app/scripts/
scp backend/scripts/auto-fix-sessions.js user@servidor:/app/scripts/
```

## 2. INSTALAR DEPENDÊNCIAS
```bash
# No servidor de produção
cd /app
npm install axios node-cron
```

## 3. INICIAR SMART GUARDIAN
```bash
# Criar diretório de logs
mkdir -p /app/logs

# Iniciar com PM2
pm2 start scripts/smart-guardian.js --name "smart-guardian" --log /app/logs/smart-guardian.log

# Ou sem PM2
node scripts/smart-guardian.js
```

## 4. VERIFICAR STATUS
```bash
pm2 list
pm2 logs smart-guardian
```

## 5. RESET MANUAL IMEDIATO (se necessário)
```bash
# Resetar sessão problemática
node scripts/auto-fix-sessions.js 26

# Ou resetar todas
node scripts/auto-fix-sessions.js all
```

## 📊 MONITORAR LOGS
```bash
# Logs do Smart Guardian
tail -f /app/logs/smart-guardian.log

# Logs do backend
docker logs whaticket-backend --tail=100 | grep -i "prekey\|invalid"
```
