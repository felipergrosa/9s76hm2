#!/usr/bin/env pwsh
# WHATICKET DEPLOY FULL LOCAL - Build local + Docker apenas para empacotar
# Resolve problemas de memória e npm ci

$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

$projectRoot = "C:\Users\feliperosa\whaticket"
$frontendImage = "felipergrosa/9s76hm2-frontend:latest"
$backendImage = "felipergrosa/9s76hm2-backend:latest"

$Cyan = "Cyan"; $Green = "Green"; $Yellow = "Yellow"; $Red = "Red"; $Gray = "Gray"

function Write-Step {
    param([string]$Message, [string]$Number = "")
    $prefix = if ($Number) { "[$Number/6] " } else { "" }
    Write-Host "`n$prefix========================================" -ForegroundColor $Cyan
    Write-Host $Message -ForegroundColor $Cyan
    Write-Host "========================================" -ForegroundColor $Cyan
}

function Write-Success { param([string]$Message) Write-Host "  ✅ $Message" -ForegroundColor $Green }
function Write-Warning { param([string]$Message) Write-Host "  ⚠️  $Message" -ForegroundColor $Yellow }
function Write-Error { param([string]$Message) Write-Host "  ❌ $Message" -ForegroundColor $Red }
function Write-Info { param([string]$Message) Write-Host "  ℹ️  $Message" -ForegroundColor $Gray }

# [1/6] Verificações
Write-Step "VERIFICAÇÕES" "1"
try {
    docker info 2>$null | Out-Null
    Write-Success "Docker Desktop está rodando"
} catch {
    Write-Error "Docker não está acessível"; exit 1
}

$dockerUser = docker info 2>$null | Select-String "Username:" | ForEach-Object { ($_ -split ":")[1].Trim() }
if ($dockerUser) { Write-Success "Docker Hub: $dockerUser" }

# [2/6] Build Frontend LOCAL
Write-Step "BUILD FRONTEND LOCAL" "2"

$frontendDir = "$projectRoot\frontend"
Set-Location $frontendDir

if (-not (Test-Path "$frontendDir\node_modules")) {
    Write-Error "node_modules não encontrado. Execute: npm install"
    exit 1
}

Write-Info "Buildando frontend localmente..."
$env:NODE_OPTIONS = "--max-old-space-size=4096"
$env:REACT_APP_BACKEND_URL = "https://chatsapi.nobreluminarias.com.br"
$env:GENERATE_SOURCEMAP = "false"

$sw = [System.Diagnostics.Stopwatch]::StartNew()

try {
    npm run build 2>&1 | Select-String "(Compiled|failed|error)" | ForEach-Object { Write-Host "    $_" -ForegroundColor $Gray }
    
    if ($LASTEXITCODE -eq 0 -and (Test-Path "$frontendDir\build\index.html")) {
        $sw.Stop()
        Write-Success "Frontend buildado em $([math]::Round($sw.Elapsed.TotalMinutes,1)) min"
    } else {
        throw "Build falhou"
    }
} catch {
    Write-Error "Falha no build frontend: $_"
    exit 1
}

# [3/6] Criar imagem Frontend
Write-Step "CRIAR IMAGEM FRONTEND" "3"

Set-Location $projectRoot

# Dockerfile minimal para frontend
@"
FROM nginx:alpine
COPY frontend/build /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
"@ | Out-File -FilePath "$projectRoot\Dockerfile.frontend" -Encoding utf8

# .dockerignore minimal
"node_modules`n.git`n*.log" | Out-File -FilePath "$projectRoot\.dockerignore.build" -Encoding utf8

# Backup e substituição temporária do .dockerignore do frontend
$originalIgnore = "$frontendDir\.dockerignore"
$backupIgnore = "$frontendDir\.dockerignore.bak"
if (Test-Path $originalIgnore) { Copy-Item $originalIgnore $backupIgnore -Force }
Copy-Item "$projectRoot\.dockerignore.build" $originalIgnore -Force

docker build -f "$projectRoot\Dockerfile.frontend" -t $frontendImage . 2>&1 | Select-String "(Successfully|failed|error)" | ForEach-Object { Write-Host "    $_" -ForegroundColor $Gray }

# Restore
if (Test-Path $backupIgnore) { Move-Item $backupIgnore $originalIgnore -Force }
Remove-Item "$projectRoot\Dockerfile.frontend" -ErrorAction SilentlyContinue
Remove-Item "$projectRoot\.dockerignore.build" -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    Write-Success "Imagem frontend criada: $(docker images $frontendImage --format '{{.Size}}')"
} else {
    Write-Error "Falha ao criar imagem frontend"
    if (Test-Path $backupIgnore) { Move-Item $backupIgnore $originalIgnore -Force }
    exit 1
}

# [4/6] Build Backend LOCAL  
Write-Step "BUILD BACKEND LOCAL" "4"

$backendDir = "$projectRoot\backend"
Set-Location $backendDir

if (-not (Test-Path "$backendDir\node_modules")) {
    Write-Error "node_modules não encontrado no backend"
    exit 1
}

Write-Info "Buildando backend localmente (TypeScript → dist)..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()

try {
    npm run build 2>&1 | Select-String "(Compiled|build|failed|error|tsc)" | ForEach-Object { Write-Host "    $_" -ForegroundColor $Gray }
    
    if ($LASTEXITCODE -eq 0 -and (Test-Path "$backendDir\dist\server.js")) {
        $sw.Stop()
        Write-Success "Backend buildado em $([math]::Round($sw.Elapsed.TotalSeconds,1)) seg"
    } else {
        throw "Build falhou"
    }
} catch {
    Write-Error "Falha no build backend: $_"
    exit 1
}

# [5/6] Criar imagem Backend
Write-Step "CRIAR IMAGEM BACKEND" "5"

Set-Location $projectRoot

# Dockerfile minimal para backend (copia tudo pronto)
@"
FROM node:20-bullseye-slim
WORKDIR /app
ENV NODE_ENV=production

# Dependências de runtime
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg chromium libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 graphicsmagick ghostscript && rm -rf /var/lib/apt/lists/*

# Copia tudo pronto do build local
COPY backend/package*.json ./
COPY backend/node_modules ./node_modules
COPY backend/dist ./dist
COPY backend/public ./public
COPY backend/certs ./certs
COPY backend/.sequelizerc ./
RUN mkdir -p ./private

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
EXPOSE 8080
CMD ["node", "dist/server.js"]
"@ | Out-File -FilePath "$projectRoot\Dockerfile.backend" -Encoding utf8

# .dockerignore que permite o que precisamos
@"
.docker-cache
.git
*.log
docs
scripts/*.ps1
scripts/*.sh
private/*
"@ | Out-File -FilePath "$projectRoot\.dockerignore.backend" -Encoding utf8

# Backup e substituição
$backendIgnore = "$backendDir\.dockerignore"
$backendIgnoreBak = "$backendDir\.dockerignore.bak"
if (Test-Path $backendIgnore) { Copy-Item $backendIgnore $backendIgnoreBak -Force }
Copy-Item "$projectRoot\.dockerignore.backend" $backendIgnore -Force

docker build -f "$projectRoot\Dockerfile.backend" -t $backendImage . 2>&1 | Select-String "(Successfully|failed|error)" | ForEach-Object { Write-Host "    $_" -ForegroundColor $Gray }

# Restore
if (Test-Path $backendIgnoreBak) { Move-Item $backendIgnoreBak $backendIgnore -Force }
Remove-Item "$projectRoot\Dockerfile.backend" -ErrorAction SilentlyContinue
Remove-Item "$projectRoot\.dockerignore.backend" -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    Write-Success "Imagem backend criada: $(docker images $backendImage --format '{{.Size}}')"
} else {
    Write-Error "Falha ao criar imagem backend"
    if (Test-Path $backendIgnoreBak) { Move-Item $backendIgnoreBak $backendIgnore -Force }
    exit 1
}

# [6/6] Push para Docker Hub
Write-Step "PUSH PARA DOCKER HUB" "6"

Write-Info "Enviando frontend..."
docker push $frontendImage 2>&1 | Select-String "(Pushed|digest|error)" | ForEach-Object { Write-Host "    $_" -ForegroundColor $Gray }
if ($LASTEXITCODE -eq 0) { Write-Success "Frontend enviado" } else { Write-Warning "Push frontend pode ter falhado" }

Write-Info "Enviando backend..."
docker push $backendImage 2>&1 | Select-String "(Pushed|digest|error)" | ForEach-Object { Write-Host "    $_" -ForegroundColor $Gray }
if ($LASTEXITCODE -eq 0) { Write-Success "Backend enviado" } else { Write-Warning "Push backend pode ter falhado" }

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
Write-Host "   4. As imagens :latest serão puxadas" -ForegroundColor $Gray

Write-Host "`n"
