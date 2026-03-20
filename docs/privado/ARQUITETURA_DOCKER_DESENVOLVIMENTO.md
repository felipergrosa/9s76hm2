# Arquitetura Docker - Desenvolvimento

## 🎯 Objetivo
Documentar a arquitetura correta do ambiente de desenvolvimento para evitar alterações acidentais.

## 📋 Estrutura Definitiva

### **Serviços Externos ao Whaticket**
- **Postgres**: Container `postgres` (rede nobreluminarias)
- **Redis**: Container `redis` (rede nobreluminarias)

### **Serviços no Whaticket**
- **Backend**: Container `whaticket-backend`
- **Frontend**: Container `whaticket-frontend`

## 🔧 Configuração Docker-Compose

```yaml
services:
  backend:
    depends_on:
      - postgres  # Serviço externo
      - redis     # Serviço externo
    environment:
      DB_HOST: postgres  # Nome do container na rede
      REDIS_URI: redis://redis:6379/0  # Nome do container na rede
```

## ⚠️ REGRAS OURO

### **1. NUNCA adicionar Postgres/Redis ao docker-compose.yml**
- ❌ **ERRADO**: Incluir services postgres/redis no compose
- ✅ **CORRETO**: Manter como serviços externos

### **2. SEMPRE usar nomes de containers para conexão**
- ❌ **ERRADO**: `host.docker.internal`
- ✅ **CORRETO**: `postgres` / `redis`

### **3. Manter depends_on para ordem correta**
```yaml
depends_on:
  - postgres
  - redis
```

### **4. Rede nobreluminarias é OBRIGATÓRIA**
```yaml
networks:
  nobreluminarias:
    external: true
```

## 🚀 Comandos de Setup

### **Criar serviços externos (única vez):**
```bash
# Postgres com volume existente (dados recuperados)
docker run -d --name postgres --network nobreluminarias \
  -v whaticket_postgres_data:/var/lib/postgresql/data \
  -p 5432:5432 \
  -e POSTGRES_DB=whaticket \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=efe487b6a861100fb704ad9f5c160cb8 \
  postgres:15-alpine

# Redis com volume existente
docker run -d --name redis --network nobreluminarias \
  -v whaticket_redis-data:/data \
  -p 6379:6379 \
  redis:6.2-alpine redis-server --appendonly yes
```

### **Subir whaticket:**
```bash
docker-compose up -d
```

## 🔄 Diferença Produção vs Desenvolvimento

| Ambiente | Postgres/Redis | Gerenciamento |
|-----------|----------------|---------------|
| **Produção** | No mesmo stack | Portainer |
| **Desenvolvimento** | Externos | Docker manual |

## 📝 Histórico de Mudanças

- **19/03/2026**: Definida arquitetura correta
- **19/03/2026**: Recuperação de dados após reinício Docker
  - **Volume correto**: `whaticket_postgres_data` (361 tickets, 395 contatos)
  - **Volume Redis**: `whaticket_redis-data`
  - **Motivo**: Containers criados sem volumes corretos
  - **Resolução**: Recriar containers com volumes existentes
- **Decisão**: Manter Redis/Postgres sempre externos ao whaticket

## ⚡ Verificação

Para confirmar que está correto:
```bash
# Verificar rede
docker network inspect nobreluminarias --format "{{range .Containers}}{{.Name}} {{end}}"

# Deve retornar: whaticket-backend redis whaticket-frontend postgres

# Verificar conexão do backend
docker exec whaticket-backend sh -c 'node -e "console.log(\"DB_HOST:\", process.env.DB_HOST); console.log(\"REDIS_URI:\", process.env.REDIS_URI)"'

# Deve retornar: DB_HOST: postgres, REDIS_URI: redis://redis:6379/0
```

---

**IMPORTANTE**: Esta arquitetura NUNCA deve ser alterada sem discussão prévia!
