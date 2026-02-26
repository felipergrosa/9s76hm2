# Script para desenvolvimento local (backend fora do Docker)
# Garante que apenas PostgreSQL e Redis estão rodando no Docker

Write-Host "🔍 Verificando Docker..." -ForegroundColor Cyan

# Parar container backend se estiver rodando
Write-Host "⏹️  Parando container backend..." -ForegroundColor Yellow
docker stop whaticket-backend 2>$null

# Garantir que PostgreSQL e Redis estão rodando
Write-Host "▶️  Iniciando PostgreSQL e Redis..." -ForegroundColor Green
docker start postgres whaticket-redis 2>$null

# Aguardar PostgreSQL ficar pronto
Write-Host "⏳ Aguardando PostgreSQL..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

# Testar conexão
$connected = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue

if ($connected) {
    Write-Host "✅ PostgreSQL acessível na porta 5432" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Iniciando backend local..." -ForegroundColor Cyan
    pnpm run dev
} else {
    Write-Host "❌ PostgreSQL não está acessível" -ForegroundColor Red
    Write-Host "Tente reiniciar o Docker Desktop e execute este script novamente" -ForegroundColor Yellow
}
