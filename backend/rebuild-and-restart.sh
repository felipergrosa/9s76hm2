#!/bin/bash

# Script para rebuild e restart do backend
# Uso: sh rebuild-and-restart.sh

echo "====================================="
echo "REBUILD E RESTART DO BACKEND"
echo "====================================="
echo ""

# 1. Ir para diretório do backend
cd "$(dirname "$0")"
echo "[1/5] Diretório atual: $(pwd)"
echo ""

# 2. Limpar build antigo
echo "[2/5] Limpando build antigo (dist/)..."
rm -rf dist
echo "✓ Build antigo removido"
echo ""

# 3. Compilar TypeScript
echo "[3/5] Compilando TypeScript → JavaScript..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ ERRO: Falha na compilação"
    exit 1
fi
echo "✓ Compilação concluída"
echo ""

# 4. Verificar se o build foi atualizado
echo "[4/5] Verificando se o build contém as correções..."
if grep -q "fantasyName" dist/services/IntegrationsServices/OpenAiService.js; then
    echo "✓ Build atualizado detectado (contém fantasyName)"
else
    echo "⚠ AVISO: Build pode não estar atualizado"
fi
echo ""

# 5. Reiniciar servidor
echo "[5/5] Reiniciando servidor..."
echo "Escolha o método de restart:"
echo "  1) PM2 (pm2 restart backend)"
echo "  2) Docker (docker-compose restart backend)"
echo "  3) Manual (você reinicia manualmente)"
echo ""
read -p "Digite 1, 2 ou 3: " choice

case $choice in
    1)
        echo "Reiniciando via PM2..."
        pm2 restart backend
        echo "✓ PM2 restart executado"
        echo ""
        echo "Para ver os logs:"
        echo "  pm2 logs backend --lines 50"
        ;;
    2)
        echo "Reiniciando via Docker..."
        cd ..
        docker-compose restart backend
        echo "✓ Docker restart executado"
        echo ""
        echo "Para ver os logs:"
        echo "  docker-compose logs -f backend"
        ;;
    3)
        echo "⚠ Reinicie manualmente o servidor agora"
        ;;
    *)
        echo "❌ Opção inválida"
        exit 1
        ;;
esac

echo ""
echo "====================================="
echo "✓ REBUILD E RESTART CONCLUÍDOS"
echo "====================================="
echo ""
echo "PRÓXIMOS PASSOS:"
echo "1. Feche o ticket 866 ou limpe o histórico"
echo "2. Inicie uma conversa nova"
echo "3. Teste com mensagens diferentes"
echo "4. Procure nos logs por: [IA][DEBUG]"
echo ""
echo "Se o bot ainda repetir, veja: SOLUCAO_BOT_REPETITIVO.md"
