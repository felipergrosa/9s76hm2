#!/bin/bash

# Script para diagnosticar problemas de dependências do npm
echo "=== DIAGNÓSTICO DE DEPENDÊNCIAS NPM ==="
echo "Data: $(date)"
echo "Node: $(node -v)"
echo "NPM: $(npm -v)"
echo ""

# Limpa cache
echo "1. Limpando cache npm..."
npm cache clean --force

# Verifica por problemas conhecidos
echo ""
echo "2. Verificando dependências problemáticas..."

# Verifica puppeteer
echo "   - Verificando Puppeteer..."
npm ls puppeteer 2>/dev/null || echo "     Puppeteer não encontrado ou com problemas"

# Verifica canvas
echo "   - Verificando Canvas..."
npm ls canvas 2>/dev/null || echo "     Canvas não encontrado ou com problemas"

# Verifica sequelize
echo "   - Verificando Sequelize..."
npm ls sequelize 2>/dev/null || echo "     Sequelize não encontrado ou com problemas"

# Verifica baileys
echo "   - Verificando Baileys..."
npm ls @whiskeysockets/baileys 2>/dev/null || echo "     Baileys não encontrado ou com problemas"

# Tenta instalar em modo verbose
echo ""
echo "3. Tentando instalação em modo verbose..."
echo "Comando: npm install --legacy-peer-deps --verbose"

# Executa com timeout para evitar travar
timeout 300s npm install --legacy-peer-deps --verbose || {
  echo ""
  echo "=== ERRO NA INSTALAÇÃO ==="
  echo "Verificando logs de erro..."
  
  # Mostra últimos erros
  if [ -d "/root/.npm/_logs" ]; then
    echo "Últimos logs de erro:"
    for f in /root/.npm/_logs/*; do
      echo "--- $f ---"
      tail -n 50 "$f" | grep -i error || echo "Nenhum erro encontrado neste log"
    done
  fi
  
  # Verifica espaço em disco
  echo ""
  echo "Verificando espaço em disco:"
  df -h
  
  # Verifica memória
  echo ""
  echo "Verificando memória:"
  free -h
  
  exit 1
}

echo ""
echo "=== INSTALAÇÃO CONCLUÍDA COM SUCESSO ==="
npm list --depth=0
