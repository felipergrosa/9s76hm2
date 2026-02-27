#!/usr/bin/env pwsh
# WHATICKET DEPLOY HÍBRIDO - Build local + Docker push
# Resolve problema de memória do Docker Desktop

$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

$projectRoot = "C:\Users\feliperosa\whaticket"
$frontendImage = "felipergrosa/9s76hm2-frontend:latest"
$backendImage = "felipergrosa/9s76hm2-backend:latest"

$Cyan = "Cyan"; $Green = "Green"; $Yellow = "Yellow"; $Red = "Red"; $Gray = "Gray"

function Write-Step {
    param([string]$Message, [string]$Number = "")
    $prefix = if ($Number) { "[$Number/5] " } else { "" }
    Write-Host "`n$prefix========================================" -ForegroundColor $Cyan
    Write-Host $Message -ForegroundColor $Cyan
    Write-Host "========================================" -ForegroundColor $Cyan
}

function Write-Success { param([string]$Message) Write-Host "  ✅ $Message" -ForegroundColor $Green }
function Write-Warning { param([string]$Message) Write-Host "  ⚠️  $Message" -ForegroundColor $Yellow }
function Write-Error { param([string]$Message) Write-Host "  ❌ $Message" -ForegroundColor $Red }
function Write-Info { param([string]$Message) Write-Host "  ℹ️  $Message" -ForegroundColor $Gray }

# [1/5] Verificações
Write-Step "VERIFICAÇÕES" "1"
try {
    docker info 2>$null | Out-Null
    Write-Success "Docker Desktop está rodando"
} catch {
    Write-Error "Docker não está acessível"; exit 1
}

$dockerUser = docker info 2>$null | Select-String "Username:" | ForEach-Object { ($_ -split ":")[1].Trim() }
if ($dockerUser) { Write-Success "Docker Hub: $dockerUser" }

# [2/5] Build Frontend LOCAL (fora do Docker)
Write-Step "BUILD FRONTEND LOCAL" "2"

$frontendDir = "$projectRoot\frontend"
Set-Location $frontendDir

# Verifica se node_modules existe
if (-not (Test-Path "$frontendDir\node_modules")) {
    Write-Error "node_modules não encontrado. Execute primeiro: npm install"
    exit 1
}

Write-Info "Buildando frontend localmente (fora do Docker)..."
Write-Info "Isso evita o problema de memória do container"

$env:NODE_OPTIONS = "--max-old-space-size=4096"
$env:REACT_APP_BACKEND_URL = "https://chatsapi.nobreluminarias.com.br"
$env:GENERATE_SOURCEMAP = "false"
$env:INLINE_RUNTIME_CHUNK = "false"

$sw = [System.Diagnostics.Stopwatch]::StartNew()

try {
    npm run build 2>&1 | ForEach-Object {
        $line = $_
        if ($line -match "(Compiled successfully|build folder|Creating|Failed|error)") {
            Write-Host "    $line" -ForegroundColor $Gray
        }
    }
    
    if ($LASTEXITCODE -eq 0 -and (Test-Path "$frontendDir\build\index.html")) {
        $sw.Stop()
        Write-Success "Frontend buildado em $([math]::Round($sw.Elapsed.TotalMinutes,1)) min"
    } else {
        throw "Build falhou"
    }
} catch {
    Write-Error "Falha no build local: $_"
    exit 1
}

# [3/5] Criar imagem Docker do Frontend (só copia build pronto)
Write-Step "CRIAR IMAGEM FRONTEND" "3"

# Cria Dockerfile temporário na RAIZ do projeto (fora do frontend)
$dockerfileContent = @"
FROM nginx:alpine
COPY frontend/build /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
"@

$dockerfileTemp = "$projectRoot\Dockerfile.frontend-deploy"
$dockerfileContent | Out-File -FilePath $dockerfileTemp -Encoding utf8

Set-Location $projectRoot

Write-Info "Criando imagem Docker a partir do build local..."
Write-Info "Contexto: raiz do projeto (inclui frontend/build)"

# Cria .dockerignore temporário que permite a pasta build
$dockerignoreTemp = "$projectRoot\.dockerignore.temp"
"node_modules`n*.log`n.git`n.vscode" | Out-File -FilePath $dockerignoreTemp -Encoding utf8

# Backup do .dockerignore original do frontend
$originalDockerignore = "$frontendDir\.dockerignore"
$dockerignoreBackup = "$frontendDir\.dockerignore.bak"
if (Test-Path $originalDockerignore) {
    Copy-Item $originalDockerignore $dockerignoreBackup -Force
}
# Substitui temporariamente
Copy-Item $dockerignoreTemp $originalDockerignore -Force

docker build -f $dockerfileTemp -t $frontendImage . 2>&1 | ForEach-Object {
    if ($_ -match "(Successfully|failed|error|build)") { Write-Host "    $_" -ForegroundColor $Gray }
}

# Restaura .dockerignore original
if (Test-Path $dockerignoreBackup) {
    Move-Item $dockerignoreBackup $originalDockerignore -Force
}

Remove-Item $dockerfileTemp -ErrorAction SilentlyContinue
Remove-Item $dockerignoreTemp -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    Write-Success "Imagem frontend criada"
    $imgSize = docker images $frontendImage --format "{{.Size}}"
    Write-Info "Tamanho: $imgSize"
} else {
    Write-Error "Falha ao criar imagem frontend"
    # Restore mesmo com erro
    if (Test-Path $dockerignoreBackup) {
        Move-Item $dockerignoreBackup $originalDockerignore -Force
    }
    exit 1
}

# [4/5] Push Frontend + Build Backend
Write-Step "PUSH FRONTEND + BUILD BACKEND" "4"

# Push Frontend em background
Write-Info "Iniciando push do frontend..."
$pushJob = Start-Job -ScriptBlock {
    param($img)
    docker push $img 2>&1
} -ArgumentList $frontendImage

# Build Backend (menos problemático que frontend)
$backendDir = "$projectRoot\backend"
Set-Location $backendDir

Write-Info "Buildando backend no Docker..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()

try {
    docker build -t $backendImage . 2>&1 | ForEach-Object {
        if ($_ -match "(Successfully|failed|error|transferring)" -and $_ -match "(GB|MB|failed|error)") {
            Write-Host "    $_" -ForegroundColor $Gray
        }
    }
    
    if ($LASTEXITCODE -eq 0) {
        $sw.Stop()
        Write-Success "Backend buildado em $([math]::Round($sw.Elapsed.TotalMinutes,1)) min"
        
        $imgSize = docker images $backendImage --format "{{.Size}}"
        Write-Info "Tamanho: $imgSize"
    } else {
        throw "Build backend falhou"
    }
} catch {
    Write-Error "Falha no build do backend: $_"
    Stop-Job $pushJob -ErrorAction SilentlyContinue
    exit 1
}

# Espera push do frontend
Write-Info "Aguardando push do frontend..."
$pushJob | Wait-Job -Timeout 300 | Out-Null
$pushResult = Receive-Job $pushJob
Remove-Job $pushJob

if ($pushResult -match "digest|successfully") {
    Write-Success "Frontend enviado para Docker Hub"
} else {
    Write-Warning "Push do frontend pode ter falhado"
    Write-Info $pushResult
}

# [5/5] Push Backend
Write-Step "PUSH BACKEND" "5"

Write-Info "Enviando backend para Docker Hub..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()

docker push $backendImage 2>&1 | ForEach-Object {
    if ($_ -match "(digest|Pushed|error)") { Write-Host "    $_" -ForegroundColor $Gray }
}

if ($LASTEXITCODE -eq 0) {
    $sw.Stop()
    Write-Success "Backend enviado em $([math]::Round($sw.Elapsed.TotalSeconds,1)) seg"
} else {
    Write-Error "Falha no push do backend"
    exit 1
}

# Resumo
Write-Host "`n========================================" -ForegroundColor $Green
Write-Host "  ✅ DEPLOY CONCLUÍDO!" -ForegroundColor $Green
Write-Host "========================================" -ForegroundColor $Green

Write-Host "`n📦 Imagens publicadas:" -ForegroundColor $Cyan
Write-Host "   • $frontendImage" -ForegroundColor White
Write-Host "   • $backendImage" -ForegroundColor White

Write-Host "`n📋 Atualizar Portainer:" -ForegroundColor $Yellow
Write-Host "   1. Acesse https://localhost:9443" -ForegroundColor $Gray
Write-Host "   2. Stacks → whaticket" -ForegroundColor $Gray
Write-Host "   3. Clique 'Update the stack'" -ForegroundColor $Gray

Write-Host "`n"
