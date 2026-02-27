#!/usr/bin/env pwsh
# REBUILD BACKEND FINAL - v4.0
# Instala production deps em pasta limpa + build local

$ErrorActionPreference = "Stop"
$backendDir = "C:\Users\feliperosa\whaticket\backend"
$tempDir = "C:\Users\feliperosa\whaticket\backend_temp_build"
$backendImage = "felipergrosa/9s76hm2-backend:latest"

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-OK($msg) { Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "❌ $msg" -ForegroundColor Red }

# 1. Criar pasta temporária limpa
Write-Step "PREPARAR AMBIENTE TEMPORÁRIO"
if (Test-Path $tempDir) {
    Write-Host "  Removendo build anterior..." -ForegroundColor Gray
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null
Write-OK "Pasta temporária criada"

# 2. Copiar arquivos necessários
Write-Step "COPIAR ARQUIVOS"
Copy-Item "$backendDir\package.json" $tempDir
Copy-Item "$backendDir\package-lock.json" $tempDir -ErrorAction SilentlyContinue
Write-OK "Manifestos copiados"

# 3. Instalar APENAS production deps
Write-Step "INSTALAR PRODUCTION DEPENDENCIES"
Set-Location $tempDir
Write-Host "  npm install --omit=dev..." -ForegroundColor Gray
npm install --omit=dev --legacy-peer-deps --no-audit --no-fund 2>&1 | Select-String "(added|removed|error)" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

if ($LASTEXITCODE -ne 0) {
    Write-Err "npm install falhou"
    exit 1
}

$nmSize = (Get-ChildItem "$tempDir\node_modules" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-OK "Production deps instalados: $([math]::Round($nmSize, 2)) MB"

# 4. Build TypeScript no backend original
Write-Step "BUILD TYPESCRIPT"
Set-Location $backendDir
npm run build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0 -or -not (Test-Path "$backendDir\dist\server.js")) {
    Write-Err "Build TypeScript falhou"
    exit 1
}
Write-OK "TypeScript buildado"

# 5. Copiar artefatos para temp
Write-Host "  Copiando artefatos..." -ForegroundColor Gray
Copy-Item "$backendDir\dist" $tempDir -Recurse
Copy-Item "$backendDir\public" $tempDir -Recurse -ErrorAction SilentlyContinue
Copy-Item "$backendDir\certs" $tempDir -Recurse -ErrorAction SilentlyContinue
Copy-Item "$backendDir\scripts" $tempDir -Recurse
Copy-Item "$backendDir\.sequelizerc" $tempDir -ErrorAction SilentlyContinue
Write-OK "Artefatos copiados"

# 6. Criar Dockerfile na pasta temp
$dockerfileContent = @"
FROM node:20-bullseye-slim
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash ffmpeg chromium \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
    graphicsmagick ghostscript && \
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

$dockerfileContent | Out-File -FilePath "$tempDir\Dockerfile" -Encoding utf8

# 7. Build imagem
Write-Step "BUILD IMAGEM DOCKER"
Set-Location $tempDir
Write-Host "  Buildando..." -ForegroundColor Gray
docker build -t $backendImage . 2>&1 | Select-String "(Successfully|failed|error)" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

if ($LASTEXITCODE -ne 0) {
    Write-Err "Build falhou"
    exit 1
}

$imgSize = docker images $backendImage --format "{{.Size}}"
Write-OK "Imagem criada: $imgSize"

# 8. Push
Write-Step "PUSH PARA DOCKER HUB"
docker push $backendImage 2>&1 | Select-String "(Pushed|digest)" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

if ($LASTEXITCODE -eq 0) {
    Write-OK "Push concluído!"
} else {
    Write-Err "Push falhou"
    exit 1
}

# 9. Limpeza
Write-Step "LIMPEZA"
Set-Location $backendDir
Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
Write-OK "Pasta temporária removida"

# 10. Resumo
Write-Step "✅ DEPLOY CONCLUÍDO"
Write-Host "Imagem: $backendImage ($imgSize)" -ForegroundColor Green
Write-Host "`n📋 Atualizar Portainer:" -ForegroundColor Yellow
Write-Host "   1. http://localhost:9443" -ForegroundColor Gray
Write-Host "   2. Stacks → whaticket → Update" -ForegroundColor Gray
Write-Host "   3. Pull and redeploy`n" -ForegroundColor Gray
