#!/bin/bash

# Validador de Arquitetura Docker - Desenvolvimento
# Verifica se a configuração está correta conforme ARQUITETURA_DOCKER_DESENVOLVIMENTO.md

echo "🔍 Validando arquitetura Docker..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verificar se postgres e redis estão na rede nobreluminarias
echo -n "📡 Verificando rede nobreluminarias... "
NETWORK_CONTAINERS=$(docker network inspect nobreluminarias --format "{{range .Containers}}{{.Name}} {{end}}" 2>/dev/null)

if [[ $NETWORK_CONTAINERS == *"postgres"* && $NETWORK_CONTAINERS == *"redis"* ]]; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ ERRO: postgres/redis não encontrados na rede${NC}"
    echo "   Containers encontrados: $NETWORK_CONTAINERS"
    exit 1
fi

# 2. Verificar se postgres/redis estão rodando
echo -n "🐘 Verificando Postgres... "
if docker ps --format "{{.Names}}" | grep -q "^postgres$"; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ ERRO: Postgres não está rodando${NC}"
    exit 1
fi

echo -n "🔴 Verificando Redis... "
if docker ps --format "{{.Names}}" | grep -q "^redis$"; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ ERRO: Redis não está rodando${NC}"
    exit 1
fi

# 3. Verificar configuração do backend
echo -n "🔧 Verificando configuração do backend... "
if docker exec whaticket-backend sh -c 'node -e "console.log(process.env.DB_HOST === \"postgres\" && process.env.REDIS_URI === \"redis://redis:6379/0\" ? \"OK\" : \"ERROR\")"' 2>/dev/null | grep -q "OK"; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ ERRO: Configuração do backend incorreta${NC}"
    echo "   DB_HOST deveria ser 'postgres'"
    echo "   REDIS_URI deveria ser 'redis://redis:6379/0'"
    exit 1
fi

# 4. Verificar se docker-compose.yml não tem services postgres/redis
echo -n "📋 Verificando docker-compose.yml... "
if grep -q "^\s*postgres:" docker-compose.yml || grep -q "^\s*redis:" docker-compose.yml; then
    echo -e "${RED}❌ ERRO: docker-compose.yml contém services postgres/redis${NC}"
    echo "   postgres/redis devem ser serviços externos!"
    exit 1
else
    echo -e "${GREEN}✅ OK${NC}"
fi

# 5. Verificar depends_on correto
echo -n "🔗 Verificando depends_on... "
if grep -A2 "depends_on:" docker-compose.yml | grep -q "postgres" && grep -A2 "depends_on:" docker-compose.yml | grep -q "redis"; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${YELLOW}⚠️  AVISO: depends_on pode não estar configurado${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Arquitetura Docker está CORRETA!${NC}"
echo ""
echo "📊 Resumo:"
echo "   - Postgres: Container externo na rede nobreluminarias"
echo "   - Redis: Container externo na rede nobreluminarias"  
echo "   - Backend: Conectado via nomes de containers"
echo "   - Frontend: Container whaticket"
echo ""
echo "✅ Ambiente pronto para desenvolvimento!"
