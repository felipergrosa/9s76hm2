# 🐳 Configuração Docker Whaticket

## ⚠️ IMPORTANTE - NÃO MODIFICAR ESTA ESTRUTURA

Esta configuração foi padronizada para manter **desenvolvimento = produção**.

## 📦 Serviços Incluídos no Docker Compose

```
┌─────────────────────────────────────┐
│  Docker Compose (whaticket)         │
├─────────────────────────────────────┤
│  ✅ Backend    (porta 8080)         │
│  ✅ Frontend   (porta 80)           │
│  ✅ Postgres   (porta 5432)         │
│  ✅ Redis      (porta 6379)         │
└─────────────────────────────────────┘
```

## 🚀 Comandos Padrão

### Subir TODOS os serviços:
```bash
docker-compose up -d
```

### Rebuild completo:
```bash
docker-compose down
docker-compose up --build -d
```

### Logs em tempo real:
```bash
docker-compose logs -f backend
```

### Parar tudo:
```bash
docker-compose down
```

### Limpar TUDO (cuidado - apaga volumes):
```bash
docker-compose down -v
```

## 📋 Volumes Persistentes

- `postgres-data`: Dados do banco de dados
- `redis-data`: Cache do Redis
- `backend-public`: Arquivos públicos (uploads)
- `backend-private`: Sessões WhatsApp

## ⚙️ Variáveis de Ambiente

Todas as configurações estão no `docker-compose.yml`:
- DB_HOST=postgres (nome do serviço)
- DB_PORT=5432
- DB_NAME=whaticket
- DB_USER=postgres
- DB_PASS=efe487b6a861100fb704ad9f5c160cb8
- REDIS_URI=redis://redis:6379/0

## 🔒 Regras de Ouro

1. **NUNCA** rode Postgres ou Redis fora do docker-compose
2. **NUNCA** mude DB_HOST para localhost ou 127.0.0.1
3. **SEMPRE** use nomes de serviços (postgres, redis)
4. **SEMPRE** suba todos os serviços juntos

## 🐛 Troubleshooting

### Porta 5432 ou 6379 já em uso:
```bash
# Windows
netstat -ano | findstr :5432
netstat -ano | findstr :6379
taskkill /PID <PID> /F
```

### Containers duplicados:
```bash
docker ps -a
docker rm -f $(docker ps -aq)
```

### Reset completo:
```bash
docker-compose down -v
docker system prune -a --volumes
docker-compose up -d
```

## ✅ Validação

Após subir, verificar:
```bash
docker ps
```

Deve mostrar:
- whaticket-backend (running)
- whaticket-frontend (running)
- whaticket-postgres (running)
- whaticket-redis (running)

---
**Data de padronização**: 2026-03-09  
**Versão Docker Compose**: 3.8  
**Status**: PRODUÇÃO PADRÃO - NÃO MODIFICAR
