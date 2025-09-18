#!/bin/bash

# Script de inicialização para PostgreSQL com pgvector
# Este script é executado automaticamente quando o banco é criado

set -e

echo "🔄 Inicializando PostgreSQL com pgvector..."

# Aguardar PostgreSQL estar pronto
until pg_isready -U postgres; do
    echo "Aguardando PostgreSQL..."
    sleep 2
done

echo "✅ PostgreSQL está pronto!"

# Criar extensão pgvector no banco template1 (para que esteja disponível em todos os bancos criados)
psql -U postgres -d template1 -c "CREATE EXTENSION IF NOT EXISTS vector;" || {
    echo "❌ Falha ao criar extensão pgvector em template1"
    exit 1
}

# Se existir um banco específico (whaticket), criar a extensão lá também
if psql -U postgres -lqt | cut -d \| -f 1 | grep -qw whaticket; then
    echo "📦 Criando extensão pgvector no banco whaticket..."
    psql -U postgres -d whaticket -c "CREATE EXTENSION IF NOT EXISTS vector;" || {
        echo "⚠️  Aviso: Não foi possível criar extensão no banco whaticket (pode não existir ainda)"
    }
fi

echo "✅ pgvector inicializado com sucesso!"
echo "🎉 Pronto para usar funcionalidades de IA e RAG!"
