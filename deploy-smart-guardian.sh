#!/bin/bash

# 🚀 DEPLOY AUTOMÁTICO DO SMART GUARDIAN EM PRODUÇÃO

echo "🔧 INICIANDO DEPLOY DO SMART GUARDIAN..."

# 1. Parar processos antigos se existirem
echo "📋 Parando processos antigos..."
pm2 stop smart-guardian 2>/dev/null || echo "Nenhum processo antigo encontrado"

# 2. Copiar scripts para produção
echo "📁 Copiando scripts para produção..."
cp backend/scripts/smart-guardian.js /app/scripts/
cp backend/scripts/auto-fix-sessions.js /app/scripts/

# 3. Instalar dependências se necessário
echo "📦 Verificando dependências..."
cd /app
npm list axios node-cron 2>/dev/null | grep -q "axios" || npm install axios node-cron

# 4. Criar diretório de logs
echo "📝 Criando diretório de logs..."
mkdir -p /app/logs

# 5. Iniciar Smart Guardian
echo "🤖 Iniciando Smart Guardian..."
pm2 start scripts/smart-guardian.js --name "smart-guardian" --log /app/logs/smart-guardian.log

# 6. Verificar status
echo "✅ Verificando status..."
pm2 list | grep smart-guardian

echo "🎯 Smart Guardian deployado com sucesso!"
echo "📊 Logs: tail -f /app/logs/smart-guardian.log"
