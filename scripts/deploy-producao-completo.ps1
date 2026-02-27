#!/usr/bin/env pwsh
# DEPLOY PRODUÇÃO COMPLETO - v1.0
# Build otimizado de frontend + backend com push automático

$ErrorActionPreference = "Stop"

# Configurações
$projectRoot = "C:\Users\feliperosa\whaticket"
$frontendDir = "$projectRoot\frontend"
$backendDir = "$projectRoot\backend"
$tempDir = "$projectRoot\backend_temp_build"
$frontendImage = "felipergrosa/9s76hm2-frontend:latest"
$backendImage = "felipergrosa/9s76hm2-backend:latest"

function Write-Step($msg) { Write-Host "`n========================================" -ForegroundColor Cyan; Write-Host $msg -ForegroundColor Cyan; Write-Host "========================================" -ForegroundColor Cyan }
function Write-OK($msg) { Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "❌ $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "ℹ️  $msg" -ForegroundColor Gray }

# Verificar Docker
Write-Step "VERIFICAÇÃO DO AMBIENTE"
try {
    docker info 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Docker não está rodando" }
    Write-OK "Docker está rodando"
} catch {
    Write-Err "Docker não está acessível. Inicie o Docker Desktop primeiro."
    exit 1
}

# ============================================
# FRONTEND
# ============================================
Write-Step "BUILD FRONTEND"

Set-Location $frontendDir
Write-Info "Buildando frontend (pode levar 3-5 minutos)..."

docker build -t $frontendImage . 2>&1 | ForEach-Object {
    if ($_ -match "(Successfully|failed|error|Step)") { Write-Host "  $_" -ForegroundColor Gray }
}

if ($LASTEXITCODE -ne 0) {
    Write-Err "Build do frontend falhou"
    exit 1
}

$frontendSize = docker images $frontendImage --format "{{.Size}}"
Write-OK "Frontend buildado: $frontendSize"

# Push Frontend
Write-Step "PUSH FRONTEND"
Write-Info "Enviando para Docker Hub..."
docker push $frontendImage 2>&1 | Select-String "(Pushed|digest|error)" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

if ($LASTEXITCODE -eq 0) {
    Write-OK "Frontend enviado com sucesso!"
} else {
    Write-Err "Push do frontend falhou"
    exit 1
}

# ============================================
# BACKEND (OTIMIZADO)
# ============================================
Write-Step "PREPARAR BACKEND (PRODUCTION DEPS)"

# Limpar pasta temp anterior
if (Test-Path $tempDir) {
    Write-Info "Removendo build anterior..."
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Copiar manifestos
Copy-Item "$backendDir\package.json" $tempDir
Copy-Item "$backendDir\package-lock.json" $tempDir -ErrorAction SilentlyContinue
Write-OK "Manifestos copiados para pasta temporária"

# Instalar APENAS production dependencies
Write-Step "INSTALAR PRODUCTION DEPENDENCIES"
Set-Location $tempDir

Write-Info "Executando npm install --omit=dev (pode levar 2-3 minutos)..."
npm install --omit=dev --legacy-peer-deps --no-audit --no-fund 2>&1 | Select-String "(added|removed|packages|error)" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

if ($LASTEXITCODE -ne 0) {
    Write-Err "npm install falhou"
    exit 1
}

$nmSize = (Get-ChildItem "$tempDir\node_modules" -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
Write-OK "Production deps instalados: $([math]::Round($nmSize, 2)) MB"

# Build TypeScript no backend original
Write-Step "BUILD TYPESCRIPT BACKEND"
Set-Location $backendDir

Write-Info "Compilando TypeScript..."
npm run build 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0 -or -not (Test-Path "$backendDir\dist\server.js")) {
    Write-Err "Build TypeScript falhou"
    exit 1
}
Write-OK "TypeScript compilado (dist/server.js criado)"

# Copiar artefatos para pasta temp
Write-Info "Copiando artefatos..."
Copy-Item "$backendDir\dist" $tempDir -Recurse -Force
if (Test-Path "$backendDir\public") { Copy-Item "$backendDir\public" $tempDir -Recurse -Force }
if (Test-Path "$backendDir\certs") { Copy-Item "$backendDir\certs" $tempDir -Recurse -Force }
Copy-Item "$backendDir\scripts" $tempDir -Recurse -Force
Copy-Item "$backendDir\.sequelizerc" $tempDir -ErrorAction SilentlyContinue
Write-OK "Artefatos copiados para pasta de build"

# Criar Dockerfile na pasta temp
$dockerfileContent = @"
FROM node:20-bullseye-slim
WORKDIR /app
ENV NODE_ENV=production

# Dependências runtime
RUN apt-get update && apt-get install -y --no-install-recommends \\
    bash ffmpeg chromium \\
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \\
    graphicsmagick ghostscript && \\
    rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY node_modules ./node_modules
COPY dist ./dist
COPY public ./public
COPY certs ./certs
COPY scripts ./scripts
COPY .sequelizerc ./
RUN mkdir -p ./private

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
EXPOSE 8080
CMD ["node", "dist/server.js"]
"@

$dockerfileContent | Out-File -FilePath "$tempDir\Dockerfile" -Encoding utf8 -Force

# Build imagem backend
Write-Step "BUILD IMAGEM BACKEND"
Set-Location $tempDir

Write-Info "Buildando imagem Docker (pode levar 5-10 minutos)..."
docker build -t $backendImage . 2>&1 | ForEach-Object {
    if ($_ -match "(Successfully|failed|error|Step [0-9]+)") { Write-Host "  $_" -ForegroundColor Gray }
}

if ($LASTEXITCODE -ne 0) {
    Write-Err "Build da imagem backend falhou"
    exit 1
}

$backendSize = docker images $backendImage --format "{{.Size}}"
Write-OK "Imagem backend criada: $backendSize"

# Push Backend
Write-Step "PUSH BACKEND"
Write-Info "Enviando para Docker Hub..."
docker push $backendImage 2>&1 | Select-String "(Pushed|digest|error)" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

if ($LASTEXITCODE -eq 0) {
    Write-OK "Backend enviado com sucesso!"
} else {
    Write-Err "Push do backend falhou"
    exit 1
}

# ============================================
# LIMPEZA E RESUMO
# ============================================
Write-Step "LIMPEZA"
Set-Location $projectRoot
Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
Write-OK "Arquivos temporários removidos"

Write-Step "✅ DEPLOY PRODUÇÃO CONCLUÍDO!"
Write-Host "" -ForegroundColor Green
Write-Host "Imagens publicadas:" -ForegroundColor White
Write-Host "  • Frontend: $frontendImage ($frontendSize)" -ForegroundColor Cyan
Write-Host "  • Backend:  $backendImage ($backendSize)" -ForegroundColor Cyan
Write-Host "" -ForegroundColor White
Write-Host "📋 Próximo passo - Atualizar Portainer:" -ForegroundColor Yellow
Write-Host "   1. Acesse: http://localhost:9443" -ForegroundColor Gray
Write-Host "   2. Stacks → whaticket" -ForegroundColor Gray
Write-Host "   3. Clique: 'Update the stack'" -ForegroundColor Gray
Write-Host "   4. Selecione: 'Pull and redeploy'" -ForegroundColor Gray
Write-Host "" -ForegroundColor White
