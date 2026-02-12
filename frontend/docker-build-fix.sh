#!/bin/sh

# Script para corrigir problemas de build no Docker
echo "🔧 Limppeando cache e node_modules..."

# Remove node_modules e package-lock.json para limpar cache
rm -rf node_modules package-lock.json

# Remove o build anterior
rm -rf build

# Instala dependências com tratamento de erros
echo "📦 Instalando dependências..."
npm install --legacy-peer-deps || npm install --legacy-peer-deps || npm install --legacy-peer-deps

# Tenta build com diferentes configurações de memória
echo "🏗️ Tentando build com 6GB de RAM..."
if NODE_OPTIONS=--max-old-space-size=6144 npm run build; then
    echo "✅ Build bem-sucedido com 6GB!"
elif NODE_OPTIONS=--max-old-space-size=4096 npm run build; then
    echo "✅ Build bem-sucedido com 4GB!"
elif NODE_OPTIONS=--max-old-space-size=3072 npm run build; then
    echo "✅ Build bem-sucedido com 3GB!"
elif npm run build; then
    echo "✅ Build bem-sucedido sem limite de memória!"
else
    echo "❌ Build falhou. Verifique os logs acima."
    exit 1
fi

echo "🎉 Build concluído com sucesso!"
