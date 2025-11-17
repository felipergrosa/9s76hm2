#!/usr/bin/env bash
# Script SEGURO para build Docker em hardware limitado
# Este script usa limites de recursos e prioridade baixa

set -e

# Configurar variáveis (ajuste conforme necessário)
export FRONT_BACKEND_URL="${FRONT_BACKEND_URL:-https://chats.nobreluminarias.com.br}"
export FRONT_SOCKET_URL="${FRONT_SOCKET_URL:-$FRONT_BACKEND_URL}"
export FRONT_PUBLIC_URL="${FRONT_PUBLIC_URL:-https://chats.nobreluminarias.com.br}"
export IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "=========================================="
echo "Build Docker Seguro - TaktChat"
echo "=========================================="
echo ""
echo "Configurações:"
echo "  Backend URL: $FRONT_BACKEND_URL"
echo "  Socket URL: $FRONT_SOCKET_URL"
echo "  Public URL: $FRONT_PUBLIC_URL"
echo "  Tag: $IMAGE_TAG"
echo ""
echo "⚠️  IMPORTANTE:"
echo "  - Feche Cursor e Anydesk antes de continuar"
echo "  - Feche servidor de desenvolvimento (npm start)"
echo "  - Build será executado com prioridade baixa"
echo ""
read -p "Continuar? (s/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    exit 1
fi

# Executar com prioridade baixa e limitação de CPU
# nice -n 19: prioridade mais baixa
# ionice -c 3: classe idle (só usa CPU quando não há outros processos)
echo ""
echo "Iniciando build com prioridade baixa..."
echo ""

# Usar o script otimizado com nice/ionice
nice -n 19 ionice -c 3 ./scripts/build-docker-optimized.sh "$IMAGE_TAG" "${1:-all}"

echo ""
echo "=========================================="
echo "✓ Build concluído!"
echo "=========================================="
