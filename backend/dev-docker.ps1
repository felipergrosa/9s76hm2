# Script para desenvolvimento com Docker (backend dentro do Docker)
# Usa docker-compose para gerenciar todos os serviços

Write-Host "🔍 Verificando Docker..." -ForegroundColor Cyan

# Verificar se Docker está acessível
try {
    docker ps 2>$null | Out-Null
    Write-Host "✅ Docker acessível" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker não está acessível" -ForegroundColor Red
    Write-Host "Reinicie o Docker Desktop e tente novamente" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "🚀 Iniciando serviços via docker-compose..." -ForegroundColor Cyan
Write-Host ""

# Subir todos os serviços
docker-compose up -d

Write-Host ""
Write-Host "✅ Serviços iniciados!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Para ver logs do backend:" -ForegroundColor Cyan
Write-Host "   docker logs whaticket-backend -f" -ForegroundColor White
Write-Host ""
Write-Host "🔄 Para rebuildar após mudanças:" -ForegroundColor Cyan
Write-Host "   docker-compose build backend && docker-compose restart backend" -ForegroundColor White
Write-Host ""
Write-Host "⏹️  Para parar tudo:" -ForegroundColor Cyan
Write-Host "   docker-compose down" -ForegroundColor White
