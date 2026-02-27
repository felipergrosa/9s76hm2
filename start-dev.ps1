# Script de Inicialização de Ambiente de Desenvolvimento Híbrido
# Inicia Banco e Redis no Docker, mas roda Backend e Frontend localmente (Performance Máxima)

$ErrorActionPreference = "Stop"

function Write-Color($text, $color) {
    Write-Host $text -ForegroundColor $color
}

# 1. Verificar e Corrigir Docker
Write-Color "=== 1. VERIFICANDO DOCKER ===" "Cyan"
$dockerProcess = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
if (-not $dockerProcess) {
    Write-Color "Docker não está rodando. Tentando iniciar..." "Yellow"
    ./scripts/fix-docker-windows.ps1
    Start-Sleep -Seconds 10
}

# 2. Subir Serviços (Banco + Redis)
Write-Color "`n=== 2. SUBINDO SERVIÇOS (POSTGRES + REDIS) ===" "Cyan"
try {
    docker-compose -f docker-compose.dev.yml up -d
    Write-Color "Serviços iniciados com sucesso!" "Green"
} catch {
    Write-Color "Erro ao subir docker-compose.dev.yml. Tentando corrigir..." "Red"
    ./scripts/fix-docker-windows.ps1
    docker-compose -f docker-compose.dev.yml up -d
}

# 3. Configurar Backend (.env para localhost)
Write-Color "`n=== 3. CONFIGURANDO BACKEND ===" "Cyan"
if (-not (Test-Path "backend/.env")) {
    Copy-Item "backend/.env.example" "backend/.env"
    Write-Color "Criado arquivo backend/.env" "Yellow"
}

# 4. Iniciar Backend (em nova janela)
Write-Color "`n=== 4. INICIANDO BACKEND (NOVA JANELA) ===" "Cyan"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run dev:auto"

# 5. Iniciar Frontend (em nova janela)
Write-Color "`n=== 5. INICIANDO FRONTEND (NOVA JANELA) ===" "Cyan"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm start"

Write-Color "`n=== AMBIENTE PRONTO ===" "Green"
Write-Color "Backend rodando em: http://localhost:8080" "White"
Write-Color "Frontend rodando em: http://localhost:3000" "White"
Write-Color "Adminer (Banco) em: http://localhost:8081" "White"
