# 🛠️ Setup de Desenvolvimento

## ⚡ Solução Automatizada (RECOMENDADO)

**Comando único que resolve tudo automaticamente:**

```bash
pnpm run dev:auto
```

### O que faz automaticamente:
1. ✅ Verifica se Docker Desktop está rodando
2. ✅ Para container backend (evita conflito porta 8080)
3. ✅ Garante PostgreSQL e Redis rodando
4. ✅ Libera porta 8080 se estiver ocupada
5. ✅ Testa conexões com banco e cache
6. ✅ Compila TypeScript
7. ✅ Aplica migrations
8. ✅ Inicia backend local com hot reload

**Vantagens:**
- ✅ Zero configuração manual
- ✅ Resolve conflitos automaticamente
- ✅ Não derruba Docker
- ✅ Hot reload instantâneo
- ✅ Debug fácil no VS Code

---

## 📋 Outras Opções

### Opção 1: Desenvolvimento Local Manual

Backend roda **fora do Docker**, apenas PostgreSQL e Redis no Docker.

```powershell
cd backend
.\dev-local.ps1
```

**Quando usar:** Se preferir controle manual do ambiente

---

## ✅ Solução 2: Desenvolvimento Full Docker (Recomendado para estabilidade)

Tudo roda **dentro do Docker**, incluindo backend.

### Como usar:
```powershell
cd backend
.\dev-docker.ps1
```

**Para ver logs:**
```bash
docker logs whaticket-backend -f
```

**Para rebuildar após mudanças:**
```bash
docker-compose build backend && docker-compose restart backend
```

**Vantagens:**
- ✅ Ambiente isolado
- ✅ Sem conflitos de porta
- ✅ Igual a produção

**Desvantagens:**
- ⚠️ Rebuild necessário após mudanças
- ⚠️ Logs via Docker

---

## 🔧 Troubleshooting

### Docker travou/caiu
```powershell
# Reiniciar Docker Desktop
Stop-Process -Name "Docker Desktop" -Force
Start-Sleep -Seconds 5
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
Start-Sleep -Seconds 30
```

### Porta 8080 ocupada
```powershell
# Matar processo na porta 8080
Get-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess | Stop-Process -Force
```

### PostgreSQL não conecta
```powershell
# Verificar se está rodando
docker ps | findstr postgres

# Reiniciar PostgreSQL
docker restart postgres

# Testar conexão
Test-NetConnection -ComputerName localhost -Port 5432
```

---

## 📝 Recomendação

**Para desenvolvimento diário:** Use `dev-local.ps1` (mais rápido)  
**Para testes de integração:** Use `dev-docker.ps1` (mais estável)  
**Para produção:** Sempre use Docker
