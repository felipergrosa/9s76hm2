# Script PowerShell para rebuild e restart do backend Windows
# Uso: .\rebuild-and-restart.ps1

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "REBUILD E RESTART DO BACKEND" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 1. Ir para diretório do backend
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath
Write-Host "[1/5] Diretório atual: $(Get-Location)" -ForegroundColor Yellow
Write-Host ""

# 2. Limpar build antigo
Write-Host "[2/5] Limpando build antigo (dist/)..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Path "dist" -Recurse -Force
    Write-Host "✓ Build antigo removido" -ForegroundColor Green
} else {
    Write-Host "ℹ Pasta dist não existia" -ForegroundColor Gray
}
Write-Host ""

# 3. Compilar TypeScript
Write-Host "[3/5] Compilando TypeScript → JavaScript..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERRO: Falha na compilação" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Compilação concluída" -ForegroundColor Green
Write-Host ""

# 4. Verificar se o build foi atualizado
Write-Host "[4/5] Verificando se o build contém as correções..." -ForegroundColor Yellow
$openAiFile = "dist\services\IntegrationsServices\OpenAiService.js"
if (Test-Path $openAiFile) {
    $content = Get-Content $openAiFile -Raw
    if ($content -match "fantasyName") {
        Write-Host "✓ Build atualizado detectado (contém fantasyName)" -ForegroundColor Green
    } else {
        Write-Host "⚠ AVISO: Build pode não estar atualizado" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠ AVISO: Arquivo OpenAiService.js não encontrado" -ForegroundColor Yellow
}
Write-Host ""

# 5. Reiniciar servidor
Write-Host "[5/5] Reiniciando servidor..." -ForegroundColor Yellow
Write-Host "Escolha o método de restart:" -ForegroundColor Cyan
Write-Host "  1) PM2 (pm2 restart backend)" -ForegroundColor White
Write-Host "  2) Docker (docker-compose restart backend)" -ForegroundColor White
Write-Host "  3) Manual (você reinicia manualmente)" -ForegroundColor White
Write-Host ""
$choice = Read-Host "Digite 1, 2 ou 3"

switch ($choice) {
    "1" {
        Write-Host "Reiniciando via PM2..." -ForegroundColor Yellow
        pm2 restart backend
        Write-Host "✓ PM2 restart executado" -ForegroundColor Green
        Write-Host ""
        Write-Host "Para ver os logs:" -ForegroundColor Cyan
        Write-Host "  pm2 logs backend --lines 50" -ForegroundColor White
    }
    "2" {
        Write-Host "Reiniciando via Docker..." -ForegroundColor Yellow
        Set-Location ..
        docker-compose restart backend
        Write-Host "✓ Docker restart executado" -ForegroundColor Green
        Write-Host ""
        Write-Host "Para ver os logs:" -ForegroundColor Cyan
        Write-Host "  docker-compose logs -f backend" -ForegroundColor White
    }
    "3" {
        Write-Host "⚠ Reinicie manualmente o servidor agora" -ForegroundColor Yellow
    }
    default {
        Write-Host "❌ Opção inválida" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "✓ REBUILD E RESTART CONCLUÍDOS" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "PRÓXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host "1. Feche o ticket 866 ou limpe o histórico" -ForegroundColor White
Write-Host "2. Inicie uma conversa nova" -ForegroundColor White
Write-Host "3. Teste com mensagens diferentes" -ForegroundColor White
Write-Host "4. Procure nos logs por: [IA][DEBUG]" -ForegroundColor White
Write-Host ""
Write-Host "Se o bot ainda repetir, veja: SOLUCAO_BOT_REPETITIVO.md" -ForegroundColor Cyan
