# 🚀 Guia de Desenvolvimento - Whaticket

Este documento descreve como o ambiente de desenvolvimento está configurado e como restaurá-lo em caso de problemas.

---

## 📋 Arquitetura Atual

### Infraestrutura (Docker)
- **PostgreSQL 15** - Banco de dados principal
- **Redis 6.2** - Cache e filas

### Aplicação (Local)
- **Backend** - Node.js rodando localmente (porta 8080)
- **Frontend** - React rodando localmente (porta 3000)

---

## ✅ Configuração Atual (Funcionando)

### Containers Docker Ativos

```bash
# PostgreSQL 15 (externo ao docker-compose)
docker ps --filter name=postgres
# Container: postgres
# Imagem: postgres:15
# Porta: 5432
# Volume: whaticket_postgres_data (criado em 06/08/2025)
# Rede: nobreluminarias

# Redis (via docker-compose)
docker ps --filter name=redis
# Container: whaticket-redis
# Imagem: redis:6.2-alpine
# Porta: 6379
# Volume: whaticket_redis-data
```

### Volumes Importantes

```bash
docker volume ls
```

**Volumes em uso:**
- `whaticket_postgres_data` - **DADOS DO BANCO (CRÍTICO - NÃO REMOVER)**
- `whaticket_redis-data` - Dados do Redis
- `whaticket_backend-private` - Sessões do WhatsApp (Baileys)
- `whaticket_backend-public` - Uploads e arquivos públicos

---

## 🔧 Como Iniciar o Ambiente de Desenvolvimento

### 1. Iniciar Infraestrutura Docker

```powershell
# Verificar se o PostgreSQL está rodando
docker ps --filter name=postgres

# Se NÃO estiver rodando, inicie:
docker start postgres

# Iniciar Redis via docker-compose
cd C:\Users\feliperosa\whaticket
docker compose up -d redis
```

### 2. Iniciar Backend (Local)

```powershell
cd C:\Users\feliperosa\whaticket\backend
npm run dev
```

O backend irá:
- Verificar se a porta 8080 está livre
- Compilar TypeScript
- Executar migrations do banco
- Iniciar o servidor em modo watch

### 3. Iniciar Frontend (Local)

```powershell
cd C:\Users\feliperosa\whaticket\frontend
npm start
```

O frontend irá:
- Verificar se a porta 3000 está livre (mata processos se necessário)
- Iniciar o servidor de desenvolvimento
- Abrir o navegador automaticamente

### 4. Acessar a Aplicação

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **Portainer**: http://localhost:9000 (gerenciamento Docker)

---

## 🆘 Recuperação em Caso de Erro

### Problema: Container PostgreSQL não inicia

**Sintoma:** Backend não conecta, erro de conexão ao banco

**Solução:**

```powershell
# 1. Verificar status do container
docker ps -a --filter name=postgres

# 2. Ver logs para identificar o erro
docker logs postgres --tail 50

# 3. Se estiver com erro de versão incompatível:
docker stop postgres
docker rm postgres

# 4. Recriar com a versão correta (PostgreSQL 15)
docker run -d \
  --name postgres \
  --network nobreluminarias \
  -e POSTGRES_DB=whaticket \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=efe487b6a861100fb704ad9f5c160cb8 \
  -p 5432:5432 \
  -v whaticket_postgres_data:/var/lib/postgresql/data \
  --restart always \
  postgres:15
```

### Problema: Perdi os dados do banco

**Sintoma:** Não consigo fazer login, banco parece vazio

**Solução:**

```powershell
# 1. Verificar qual volume está sendo usado
docker inspect postgres --format='{{.Mounts}}'

# 2. Deve mostrar: whaticket_postgres_data
# Se mostrar outro volume, o container está usando o volume errado!

# 3. Listar todos os volumes
docker volume ls

# 4. Verificar data de criação do volume correto
docker volume inspect whaticket_postgres_data

# 5. Se o container estiver usando volume errado:
docker stop postgres
docker rm postgres

# 6. Recriar apontando para o volume correto
docker run -d \
  --name postgres \
  --network nobreluminarias \
  -e POSTGRES_DB=whaticket \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=efe487b6a861100fb704ad9f5c160cb8 \
  -p 5432:5432 \
  -v whaticket_postgres_data:/var/lib/postgresql/data \
  --restart always \
  postgres:15
```

### Problema: Porta 8080 ou 3000 já em uso

**Sintoma:** Backend ou frontend não inicia

**Solução:**

```powershell
# Backend (porta 8080)
netstat -ano | findstr :8080
# Anote o PID e mate o processo:
taskkill /PID <PID> /F

# Frontend (porta 3000)
netstat -ano | findstr :3000
# Anote o PID e mate o processo:
taskkill /PID <PID> /F

# OU simplesmente rode npm start - o script já mata automaticamente
```

### Problema: Migration falha

**Sintoma:** Backend para durante `npx sequelize db:migrate`

**Solução:**

```powershell
# 1. Verificar se o PostgreSQL está rodando
docker ps --filter name=postgres

# 2. Testar conexão manual
docker exec postgres psql -U postgres -d whaticket -c "SELECT version();"

# 3. Se a migration específica falhar, verificar o arquivo:
# backend/src/database/migrations/<nome-da-migration>.js

# 4. Executar migration manualmente (se necessário)
cd backend
npx sequelize db:migrate
```

### Problema: Redis não conecta

**Sintoma:** Warnings sobre Redis client no backend

**Solução:**

```powershell
# 1. Verificar se Redis está rodando
docker ps --filter name=redis

# 2. Se não estiver, iniciar:
docker compose up -d redis

# 3. Testar conexão
docker exec whaticket-redis redis-cli ping
# Deve retornar: PONG
```

---

## 📦 Backup e Restauração

### Fazer Backup do Banco

```powershell
# Backup completo
docker exec postgres pg_dump -U postgres whaticket > backup_$(Get-Date -Format "yyyyMMdd_HHmmss").sql

# Backup apenas schema
docker exec postgres pg_dump -U postgres --schema-only whaticket > schema_backup.sql

# Backup apenas dados
docker exec postgres pg_dump -U postgres --data-only whaticket > data_backup.sql
```

### Restaurar Backup

```powershell
# Restaurar de um arquivo SQL
Get-Content backup_20251030_020000.sql | docker exec -i postgres psql -U postgres -d whaticket
```

### Backup dos Volumes Docker

```powershell
# Backup do volume de dados do PostgreSQL
docker run --rm -v whaticket_postgres_data:/data -v ${PWD}:/backup ubuntu tar czf /backup/postgres_data_backup.tar.gz /data

# Backup das sessões do WhatsApp
docker run --rm -v whaticket_backend-private:/data -v ${PWD}:/backup ubuntu tar czf /backup/backend_private_backup.tar.gz /data
```

---

## 🔍 Comandos Úteis de Diagnóstico

```powershell
# Ver todos os containers
docker ps -a

# Ver todos os volumes
docker volume ls

# Ver uso de espaço do Docker
docker system df

# Ver logs do backend (se estiver em container)
docker logs -f whaticket-backend

# Ver logs do PostgreSQL
docker logs -f postgres

# Ver logs do Redis
docker logs -f whaticket-redis

# Conectar ao banco via psql
docker exec -it postgres psql -U postgres -d whaticket

# Executar comando SQL direto
docker exec postgres psql -U postgres -d whaticket -c "SELECT COUNT(*) FROM \"Users\";"

# Ver configuração de rede
docker network inspect nobreluminarias

# Ver detalhes de um volume
docker volume inspect whaticket_postgres_data
```

---

## ⚠️ IMPORTANTE - NÃO FAZER

❌ **NÃO remover o volume `whaticket_postgres_data`** - contém todos os dados do banco  
❌ **NÃO mudar a versão do PostgreSQL** sem fazer backup e migration  
❌ **NÃO usar `docker compose down -v`** - remove todos os volumes (perda de dados)  
❌ **NÃO remover o volume `whaticket_backend-private`** - contém sessões do WhatsApp  

---

## 📝 Informações Técnicas

### Credenciais do Banco
- **Host**: localhost (dev local) ou `postgres` (dentro da rede Docker)
- **Porta**: 5432
- **Database**: whaticket
- **User**: postgres
- **Password**: efe487b6a861100fb704ad9f5c160cb8

### Rede Docker
- **Nome**: nobreluminarias (external)
- **Tipo**: bridge

### Versões
- **PostgreSQL**: 15.x
- **Redis**: 6.2-alpine
- **Node.js**: 22.18.0
- **TypeScript**: 4.9.5

---

## 🔄 Reiniciar Tudo do Zero (Emergência)

Se tudo falhar e você precisar reiniciar completamente:

```powershell
# 1. Parar tudo
docker stop postgres whaticket-redis
cd C:\Users\feliperosa\whaticket\backend
# Ctrl+C para parar o backend
cd C:\Users\feliperosa\whaticket\frontend
# Ctrl+C para parar o frontend

# 2. Iniciar PostgreSQL
docker start postgres
# OU se não existir:
docker run -d --name postgres --network nobreluminarias \
  -e POSTGRES_DB=whaticket \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=efe487b6a861100fb704ad9f5c160cb8 \
  -p 5432:5432 \
  -v whaticket_postgres_data:/var/lib/postgresql/data \
  --restart always postgres:15

# 3. Iniciar Redis
cd C:\Users\feliperosa\whaticket
docker compose up -d redis

# 4. Aguardar 10 segundos para os containers iniciarem
Start-Sleep -Seconds 10

# 5. Iniciar Backend
cd backend
npm run dev

# 6. Iniciar Frontend (em outro terminal)
cd frontend
npm start
```

---

## 📞 Checklist de Verificação

Antes de reportar um problema, verifique:

- [ ] Docker Desktop está rodando?
- [ ] Container `postgres` está "Up" (não "Restarting")?
- [ ] Container `whaticket-redis` está "Up"?
- [ ] Volume `whaticket_postgres_data` existe?
- [ ] Portas 5432, 6379, 8080 e 3000 estão livres?
- [ ] Backend consegue conectar ao banco? (veja logs)
- [ ] Frontend consegue conectar ao backend? (veja console do navegador)

---

**Última atualização:** 30/10/2025  
**Versão do projeto:** 2.2.2v-26
