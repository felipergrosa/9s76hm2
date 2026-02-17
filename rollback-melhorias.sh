#!/bin/bash

# ROLLBACK RÁPIDO - WHATICKET
# Uso: ./rollback-melhorias.sh [tag_do_backup]

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Variáveis
BACKUP_TAG=${1:-}
DATE=$(date +%Y%m%d_%H%M%S)

if [ -z "$BACKUP_TAG" ]; then
    echo -e "${YELLOW}📋 Lista de backups disponíveis:${NC}"
    git tag | grep "backup-" | sort -r
    echo -e "${RED}❌ É necessário informar uma tag de backup${NC}"
    echo -e "${YELLOW}Uso: ./rollback-melhorias.sh backup-homologacao-20250217_120000${NC}"
    exit 1
fi

echo -e "${YELLOW}🔄 Iniciando rollback para $BACKUP_TAG${NC}"

# 1. Confirmar
echo -e "${RED}⚠️ ATENÇÃO: Isso vai voltar o código para a versão do backup${NC}"
read -p "Tem certeza? (s/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo -e "${YELLOW}❌ Rollback cancelado${NC}"
    exit 1
fi

# 2. Backup do estado atual (antes do rollback)
echo -e "${YELLOW}📦 Criando backup do estado atual...${NC}"
git tag pre-rollback-$DATE
git push origin --tags

# 3. Voltar código
echo -e "${YELLOW}📥 Voltando código para $BACKUP_TAG...${NC}"
git checkout $BACKUP_TAG
git checkout -b rollback-$BACKUP_TAG

# 4. Desativar todas as features
echo -e "${YELLOW}⚙️ Desativando features...${NC}"
if [ -f .env ]; then
    # Remover features do .env
    sed -i '/ENABLE_SESSION_READY_CONTROL/d' .env
    sed -i '/ENABLE_DETAILED_LOGS/d' .env
    sed -i '/ENABLE_PERSISTENT_STORE/d' .env
    echo -e "${GREEN}✅ Features desativadas${NC}"
fi

# 5. Parar serviços
echo -e "${YELLOW}⏹️ Parando serviços...${NC}"
docker-compose down

# 6. Limpar volumes (se necessário)
echo -e "${YELLOW}🧹 Limpando volumes (se necessário)...${NC}"
# Opcional: descomente se precisar limpar
# docker volume rm whaticket_backend-public whaticket_backend-private

# 7. Build e deploy
echo -e "${YELLOW}🔨 Build das imagens...${NC}"
docker-compose build --no-cache

# 8. Subir serviços
echo -e "${YELLOW}⬆️ Subindo serviços...${NC}"
docker-compose up -d

# 9. Aguardar
echo -e "${YELLOW}⏳ Aguardando serviços...${NC}"
sleep 30

# 10. Verificação
echo -e "${YELLOW}🔍 Verificando serviços...${NC}"
if curl -f http://localhost:8080/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend saudável${NC}"
else
    echo -e "${RED}❌ Problema no backend${NC}"
    echo -e "${YELLOW}Verificando logs...${NC}"
    docker-compose logs --tail=50 backend
    exit 1
fi

# 11. Restaurar banco (se necessário)
read -p "Deseja restaurar o banco do backup? (s/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo -e "${YELLOW}💾 Restaurando banco...${NC}"
    # Encontrar arquivo de backup mais recente
    BACKUP_FILE=$(ls -t /opt/whaticket-backups/backup_db_*.sql | head -1)
    if [ -f "$BACKUP_FILE" ]; then
        docker exec -i postgres psql -U postgres -d whaticket < $BACKUP_FILE
        echo -e "${GREEN}✅ Banco restaurado${NC}"
    else
        echo -e "${RED}❌ Arquivo de backup não encontrado${NC}"
    fi
fi

# 12. Resumo
echo -e "${GREEN}🎉 Rollback concluído!${NC}"
echo -e "${GREEN}📍 Tag atual: $BACKUP_TAG${NC}"
echo -e "${GREEN}📅 Data/Hora: $(date)${NC}"
echo -e "${GREEN}🏷️ Backup do estado atual: pre-rollback-$DATE${NC}"

# 13. Comandos úteis
echo -e "${YELLOW}📌 Comandos úteis:${NC}"
echo "  - Verificar logs: docker-compose logs -f"
echo "  - Voltar para main: git checkout main && git pull && docker-compose up -d --build"
echo "  - Listar branches: git branch -a"

echo -e "${GREEN}✨ Rollback finalizado!${NC}"
