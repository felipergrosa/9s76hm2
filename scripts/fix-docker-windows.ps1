Write-Host "=== REINICIANDO DOCKER DESKTOP (MODO SEGURO) ===" -ForegroundColor Cyan
Write-Host "Isso NÃO apaga seus volumes ou containers, apenas reinicia o motor." -ForegroundColor Yellow

# 1. Parar Docker Desktop
Write-Host "Parando processos do Docker..."
Get-Process "Docker Desktop" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process "com.docker.backend" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process "com.docker.service" -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. Reiniciar subsistema WSL (O segredo para corrigir 'closed pipe')
Write-Host "Reiniciando WSL2 (backend do Docker)..."
wsl --shutdown

# 3. Aguardar limpeza
Write-Host "Aguardando 10 segundos..."
Start-Sleep -Seconds 10

# 4. Iniciar Docker novamente
Write-Host "Iniciando Docker Desktop..."
$dockerPath = "C:\Program Files\Docker\Docker\Docker Desktop.exe"

if (Test-Path $dockerPath) {
    Start-Process $dockerPath
    Write-Host "Docker solicitado para iniciar. Aguarde o ícone da baleia estabilizar." -ForegroundColor Green
} else {
    Write-Host "ERRO: Não encontrei o executável do Docker em: $dockerPath" -ForegroundColor Red
}
