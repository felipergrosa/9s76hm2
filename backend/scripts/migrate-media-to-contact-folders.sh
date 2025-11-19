#!/bin/bash

# ========================================
# SCRIPT: Migrar mídias antigas para pastas por contato
# ========================================
# Este script move arquivos de mídia da raiz de company{id}
# para as pastas contact{id}/ corretas, baseado no banco de dados
#
# IMPORTANTE: Execute este script no SERVIDOR VPS!
# ========================================

echo "🔄 Iniciando migração de mídias..."

# Variáveis (ajustar conforme necessário)
DB_NAME="whaticket"
DB_USER="postgres"
DB_HOST="postgres"  # Nome do container Docker
COMPANY_ID=1
PUBLIC_PATH="/opt/whaticket-data/public/company${COMPANY_ID}"

echo "📂 Pasta base: $PUBLIC_PATH"
echo ""

# 1. Criar query SQL para obter mapeamento arquivo -> contactId
echo "📊 Gerando lista de mídias do banco de dados..."

# Executar dentro do container do banco
docker exec -i $(docker ps -qf "name=postgres") psql -U $DB_USER -d $DB_NAME -t -A -F"," <<EOF > /tmp/media_migration.csv
SELECT 
  DISTINCT
  CASE 
    WHEN "mediaUrl" LIKE 'contact%/%' THEN split_part("mediaUrl", '/', 2)
    ELSE "mediaUrl"
  END as filename,
  "contactId"
FROM "Messages"
WHERE "mediaUrl" IS NOT NULL 
  AND "mediaUrl" != ''
  AND "contactId" IS NOT NULL
  AND "companyId" = ${COMPANY_ID}
ORDER BY filename;
EOF

if [ ! -s /tmp/media_migration.csv ]; then
  echo "❌ Erro: Não foi possível obter dados do banco"
  exit 1
fi

echo "✅ Lista gerada: $(wc -l < /tmp/media_migration.csv) registros"
echo ""

# 2. Processar cada arquivo
MOVED=0
SKIPPED=0
ERROR=0

while IFS=',' read -r filename contact_id; do
  # Limpar whitespace
  filename=$(echo "$filename" | tr -d '[:space:]')
  contact_id=$(echo "$contact_id" | tr -d '[:space:]')
  
  # Pular linhas vazias
  if [ -z "$filename" ] || [ -z "$contact_id" ]; then
    continue
  fi
  
  # Verificar se arquivo existe na raiz
  SOURCE_FILE="$PUBLIC_PATH/$filename"
  
  if [ ! -f "$SOURCE_FILE" ]; then
    # Arquivo não existe na raiz (pode já estar migrado ou não existir)
    ((SKIPPED++))
    continue
  fi
  
  # Criar pasta de destino
  DEST_DIR="$PUBLIC_PATH/contact${contact_id}"
  DEST_FILE="$DEST_DIR/$filename"
  
  # Verificar se já existe no destino
  if [ -f "$DEST_FILE" ]; then
    echo "⚠️  Já existe: $filename (contactId: $contact_id)"
    ((SKIPPED++))
    continue
  fi
  
  # Criar pasta se não existir
  mkdir -p "$DEST_DIR"
  chmod 777 "$DEST_DIR"
  
  # Mover arquivo
  if mv "$SOURCE_FILE" "$DEST_FILE"; then
    echo "✅ Movido: $filename → contact${contact_id}/"
    ((MOVED++))
  else
    echo "❌ ERRO ao mover: $filename"
    ((ERROR++))
  fi
  
done < /tmp/media_migration.csv

# 3. Resumo
echo ""
echo "========================================="
echo "📊 RESUMO DA MIGRAÇÃO"
echo "========================================="
echo "✅ Arquivos movidos: $MOVED"
echo "⏭️  Arquivos pulados: $SKIPPED"
echo "❌ Erros: $ERROR"
echo ""

if [ $ERROR -eq 0 ]; then
  echo "🎉 Migração concluída com sucesso!"
else
  echo "⚠️  Migração concluída com alguns erros"
fi

# 4. Limpar
rm -f /tmp/media_migration.csv

echo ""
echo "💡 PRÓXIMOS PASSOS:"
echo "1. Verificar se as imagens aparecem corretamente no frontend"
echo "2. Se tudo estiver OK, fazer backup e limpar arquivos órfãos da raiz"
echo ""
