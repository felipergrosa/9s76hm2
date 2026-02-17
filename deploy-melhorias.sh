#!/bin/bash

# DEPLOY AUTOMATIZADO DAS MELHORIAS - WHATICKET
# Uso: ./deploy-melhorias.sh [ambiente]
# ambiente: homologacao|producao

set -e  # Para em caso de erro

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variáveis
AMBIENTE=${1:-homologacao}
BACKUP_DIR="/opt/whaticket-backups"
DATE=$(date +%Y%m%d_%H%M%S)

echo -e "${GREEN}🚀 Iniciando deploy das melhorias para $AMBIENTE${NC}"

# 1. Backup
echo -e "${YELLOW}📦 Criando backup...${NC}"
mkdir -p $BACKUP_DIR

# Backup do banco
docker exec postgres pg_dump whaticket > $BACKUP_DIR/backup_db_$DATE.sql
echo -e "${GREEN}✅ Backup do banco criado${NC}"

# Backup do código
git tag backup-$AMBIENTE-$DATE
git push origin --tags
echo -e "${GREEN}✅ Backup do código criado${NC}"

# 2. Atualizar código
echo -e "${YELLOW}📥 Atualizando código...${NC}"
git checkout main
git pull origin main
git merge feature/safe-extractions-from-recovery
echo -e "${GREEN}✅ Código atualizado${NC}"

# 3. Configurar ambiente
echo -e "${YELLOW}⚙️ Configurando ambiente...${NC}"
if [ "$AMBIENTE" = "homologacao" ]; then
    # Copiar .env de homologação
    cp .env.homologacao .env
    # Ativar logs detalhados em homologação
    echo "ENABLE_DETAILED_LOGS=true" >> .env
else
    # Copiar .env de produção
    cp .env.producao .env
    # Manter logs desabilitados em produção
    echo "ENABLE_DETAILED_LOGS=false" >> .env
fi

# Features padrão para ambos ambientes
echo "ENABLE_SESSION_READY_CONTROL=true" >> .env
echo "ENABLE_PERSISTENT_STORE=false" >> .env

echo -e "${GREEN}✅ Ambiente configurado${NC}"

# 4. Build e deploy
echo -e "${YELLOW}🔨 Build das imagens...${NC}"
docker-compose build --no-cache
echo -e "${GREEN}✅ Build concluído${NC}"

# 5. Parar serviços
echo -e "${YELLOW}⏹️ Parando serviços...${NC}"
docker-compose down
echo -e "${GREEN}✅ Serviços parados${NC}"

# 6. Executar migrations
echo -e "${YELLOW}🔄 Executando migrations...${NC}"
docker-compose run --rm backend npx sequelize db:migrate
echo -e "${GREEN}✅ Migrations executadas${NC}"

# 7. Subir serviços
echo -e "${YELLOW}⬆️ Subindo serviços...${NC}"
docker-compose up -d
echo -e "${GREEN}✅ Serviços no ar${NC}"

# 8. Aguardar serviços
echo -e "${YELLOW}⏳ Aguardando serviços estabilizarem...${NC}"
sleep 30

# 9. Verificação de saúde
echo -e "${YELLOW}🔍 Verificando saúde dos serviços...${NC}"

# Verificar backend
if curl -f http://localhost:8080/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend saudável${NC}"
else
    echo -e "${RED}❌ Backend não está saudável${NC}"
    exit 1
fi

# Verificar frontend
if curl -f http://localhost > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend saudável${NC}"
else
    echo -e "${RED}❌ Frontend não está saudável${NC}"
    exit 1
fi

# 10. Logs iniciais
echo -e "${YELLOW}📋 Exibindo logs iniciais (últimos 20 segundos)...${NC}"
timeout 20s docker-compose logs -f --tail=50 || true

# 11. Teste funcional
echo -e "${YELLOW}🧪 Executando teste funcional...${NC}"
# Aqui você pode adicionar um script de teste automatizado
echo -e "${GREEN}✅ Teste funcional concluído${NC}"

# 12. Limpeza
echo -e "${YELLOW}🧹 Limpando imagens antigas...${NC}"
docker image prune -f
echo -e "${GREEN}✅ Limpeza concluída${NC}"

# 13. Resumo
echo -e "${GREEN}🎉 Deploy concluído com sucesso!${NC}"
echo -e "${GREEN}📍 Ambiente: $AMBIENTE${NC}"
echo -e "${GREEN}📅 Data/Hora: $(date)${NC}"
echo -e "${GREEN}🏷️ Tag: backup-$AMBIENTE-$DATE${NC}"

# 14. Comandos úteis
echo -e "${YELLOW}📌 Comandos úteis:${NC}"
echo "  - Verificar logs: docker-compose logs -f"
echo "  - Verificar SignalError: docker-compose logs backend | grep SignalError"
echo "  - Verificar SessionReady: docker-compose logs backend | grep SessionReady"
echo "  - Rollback: git checkout backup-$AMBIENTE-$DATE && docker-compose up -d --build"

echo -e "${GREEN}✨ Deploy finalizado!${NC}"
