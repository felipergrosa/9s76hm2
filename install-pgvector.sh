#!/bin/bash

# Script para instalar pgvector automaticamente
# Compatível com Ubuntu/Debian

set -e

echo "🔄 Instalando pgvector..."

# Atualizar repositório
apt-get update

# Instalar PostgreSQL repository (se não estiver instalado)
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL não encontrado. Instalando..."
    apt-get install -y postgresql postgresql-contrib
fi

# Adicionar repositório do PostgreSQL se necessário
if [ ! -f /etc/apt/sources.list.d/pgdg.list ]; then
    echo "Adicionando repositório PostgreSQL..."
    apt-get install -y wget ca-certificates
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
    echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
    apt-get update
fi

# Detectar versão do PostgreSQL
PG_VERSION=$(psql --version | grep -oP '\d+\.\d+' | head -1 | cut -d. -f1)

if [ -z "$PG_VERSION" ]; then
    echo "❌ Não foi possível detectar a versão do PostgreSQL"
    exit 1
fi

echo "📦 Versão do PostgreSQL detectada: $PG_VERSION"

# Instalar pgvector para a versão correta
case $PG_VERSION in
    15)
        apt-get install -y postgresql-15-pgvector
        ;;
    14)
        apt-get install -y postgresql-14-pgvector
        ;;
    13)
        apt-get install -y postgresql-13-pgvector
        ;;
    12)
        apt-get install -y postgresql-12-pgvector
        ;;
    *)
        echo "❌ Versão PostgreSQL $PG_VERSION não suportada. Use PostgreSQL 12-15."
        exit 1
        ;;
esac

# Reiniciar PostgreSQL para carregar a extensão
systemctl restart postgresql || service postgresql restart || echo "PostgreSQL reiniciado"

echo "✅ pgvector instalado com sucesso!"
echo ""
echo "📝 Para criar a extensão no banco de dados, execute:"
echo "   psql -U postgres -d nome_do_banco -c 'CREATE EXTENSION IF NOT EXISTS vector;'"
echo ""
echo "🔍 Para verificar se está funcionando:"
echo "   psql -U postgres -d nome_do_banco -c 'SELECT * FROM pg_extension WHERE extname = \"vector\";'"
