#!/bin/bash
# clean-signal-production.sh - Limpa sessões Signal corrompidas em produção Docker
# Uso: ./clean-signal-production.sh [whatsapp_id] [company_id]

set -e

WHATSAPP_ID=${1:-31}
COMPANY_ID=${2:-1}
CONTAINER_NAME="whaticket-backend"
VOLUME_NAME="whaticket_backend-private"

echo "🧹 Limpando sessões Signal corrompidas"
echo "   WhatsApp ID: $WHATSAPP_ID"
echo "   Company ID: $COMPANY_ID"
echo ""

# Verificar se container está rodando
if ! docker ps --format "{{.Names}}" | grep -q "$CONTAINER_NAME"; then
    echo "❌ Container $CONTAINER_NAME não está rodando!"
    echo "   Verifique: docker ps"
    exit 1
fi

echo "1️⃣  Parando o container backend..."
docker stop "$CONTAINER_NAME"

echo ""
echo "2️⃣  Limpando arquivos Signal (session-*, sender-key-*, pre-key-*)..."
docker run --rm -v "$VOLUME_NAME:/data" alpine:latest \
    sh -c "cd /data/sessions/$COMPANY_ID/$WHATSAPP_ID 2>/dev/null || exit 0; \
           echo '   Arquivos antes:'; ls -1 | wc -l; \
           rm -f session-* sender-key-* pre-key-*; \
           echo '   Arquivos depois:'; ls -1 | wc -l; \
           echo ''; \
           echo '   Arquivos preservados (creds, app-state):'; \
           ls -1 creds-* app-state-* 2>/dev/null || echo '   (nenhum encontrado)'"

echo ""
echo "3️⃣  Reiniciando o container..."
docker start "$CONTAINER_NAME"

echo ""
echo "✅ Limpeza concluída!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Aguarde 30-60 segundos para o backend subir"
echo "   2. Verifique os logs: docker logs $CONTAINER_NAME -f --tail 50"
echo "   3. Procure por: 'Reassumi como LÍDER' e 'Conexão estabelecida'"
echo ""
echo "🔧 Se ainda houver problemas após 2 minutos:"
echo "   docker exec -it $CONTAINER_NAME sh"
echo "   ls -la /app/private/sessions/$COMPANY_ID/$WHATSAPP_ID/"
