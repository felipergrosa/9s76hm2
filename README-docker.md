# Guia de Uso do Docker - Whaticket

## 🔧 Desenvolvimento Local

Para desenvolver localmente (backend e frontend rodando fora do Docker):

```powershell
# 1. Subir apenas PostgreSQL e Redis
docker compose up -d

# 2. Verificar se estão rodando
docker compose ps

# 3. Rodar backend localmente
cd backend
npm run dev

# 4. Rodar frontend localmente (em outro terminal)
cd frontend
npm start
```

**URLs de acesso:**
- Frontend: http://localhost:3000
- Backend: http://localhost:8080
- PostgreSQL: localhost:5432
- Redis: localhost:6379

---

## 🚀 Produção (tudo no Docker)

Para rodar toda a stack em containers:

```powershell
# Subir todos os serviços (incluindo backend e frontend)
docker compose --profile production up -d

# Verificar status
docker compose ps

# Ver logs
docker compose logs -f

# Parar tudo
docker compose --profile production down
```

**URLs de acesso:**
- Frontend: http://localhost (porta 80)
- Backend: http://localhost:8080

---

## 📊 Comandos Úteis

```powershell
# Ver logs de um serviço específico
docker compose logs -f postgres
docker compose logs -f redis
docker compose logs -f backend
docker compose logs -f frontend

# Reiniciar um serviço
docker compose restart postgres

# Parar apenas infraestrutura (mantém dados)
docker compose down

# Parar tudo incluindo volumes (APAGA DADOS!)
docker compose down -v

# Reconstruir imagens
docker compose build

# Ver volumes
docker volume ls

# Backup do banco
docker exec whaticket-postgres pg_dump -U postgres whaticket > backup.sql

# Restaurar backup
docker exec -i whaticket-postgres psql -U postgres whaticket < backup.sql
```

---

## 🔍 Troubleshooting

### Backend não conecta no banco
- Verifique se postgres está rodando: `docker compose ps`
- Veja os logs: `docker compose logs postgres`
- Teste conexão: `docker exec whaticket-postgres pg_isready -U postgres`

### Redis não conecta
- Verifique se redis está rodando: `docker compose ps`
- Teste: `docker exec whaticket-redis redis-cli ping` (deve retornar PONG)

### Porta já em uso
- Backend (8080): `netstat -ano | findstr :8080` e mate o processo
- Frontend (3000): `netstat -ano | findstr :3000` e mate o processo
- Postgres (5432): `netstat -ano | findstr :5432` e mate o processo

### Docker Desktop não inicia
- Reinicie o serviço "Docker Desktop Service" no Windows
- Reinicie a máquina
- Verifique logs em: `%LOCALAPPDATA%\Docker\log.txt`
