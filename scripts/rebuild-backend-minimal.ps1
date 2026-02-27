#!/usr/bin/env pwsh
# REBUILD BACKEND ULTRA-OTIMIZADO - v3.0
# Copia node_modules de produção já instalados (evita npm install no Docker)

$ErrorActionPreference = "Stop"
$backendDir = "C:\Users\feliperosa\whaticket\backend"
$backendImage = "felipergrosa/9s76hm2-backend:latest"

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-OK($msg) { Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "❌ $msg" -ForegroundColor Red }

# 1. Build TypeScript local
Write-Step "BUILD TYPESCRIPT LOCAL"
Set-Location $backendDir

if (-not (Test-Path "$backendDir\node_modules")) {
    Write-Err "node_modules não encontrado. Execute: npm install"
    exit 1
}

Write-Host "  Buildando TypeScript → dist..." -ForegroundColor Gray
npm run build 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0 -or -not (Test-Path "$backendDir\dist\server.js")) {
    Write-Err "Build TypeScript falhou"
    exit 1
}
Write-OK "TypeScript buildado"

# 2. Criar node_modules de produção
Write-Step "PREPARAR NODE_MODULES DE PRODUÇÃO"

$prodModules = "$backendDir\node_modules_prod"
if (Test-Path $prodModules) {
    Write-Host "  Removendo node_modules_prod antigo..." -ForegroundColor Gray
    Remove-Item $prodModules -Recurse -Force
}

Write-Host "  Copiando node_modules..." -ForegroundColor Gray
Copy-Item "$backendDir\node_modules" $prodModules -Recurse -Force

Write-Host "  Removendo devDependencies..." -ForegroundColor Gray
Set-Location $prodModules\..
npm prune --omit=dev --prefix $prodModules 2>&1 | Out-Null

$prodSize = (Get-ChildItem $prodModules -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-OK "node_modules_prod criado: $([math]::Round($prodSize, 2)) MB"

# 3. Criar Dockerfile mínimo
Write-Step "CRIAR DOCKERFILE MÍNIMO"

$dockerfileContent = @"
FROM node:20-bullseye-slim
WORKDIR /app
ENV NODE_ENV=production

# Dependências runtime mínimas
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash ffmpeg chromium \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
    graphicsmagick ghostscript && \
    rm -rf /var/lib/apt/lists/*

# Copia package.json (apenas para referência)
COPY package.json ./

# Copia node_modules de produção (SEM npm install)
COPY node_modules_prod ./node_modules

# Copia artefatos buildados
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

$dockerfilePath = "$backendDir\Dockerfile.minimal"
$dockerfileContent | Out-File -FilePath $dockerfilePath -Encoding utf8
Write-OK "Dockerfile mínimo criado"

# 4. Criar .dockerignore otimizado
@"
node_modules
.docker-cache
.wwebjs_auth
.wwebjs_cache
.git
*.log
coverage
docs
*.md
.env*
test
tests
"@ | Out-File -FilePath "$backendDir\.dockerignore.minimal" -Encoding utf8

# 5. Build imagem Docker
Write-Step "BUILD IMAGEM DOCKER"
Set-Location $backendDir

$originalIgnore = "$backendDir\.dockerignore"
$backupIgnore = "$backendDir\.dockerignore.bak"
if (Test-Path $originalIgnore) { Copy-Item $originalIgnore $backupIgnore -Force }
Copy-Item "$backendDir\.dockerignore.minimal" $originalIgnore -Force

Write-Host "  Buildando imagem mínima..." -ForegroundColor Gray
docker build -f $dockerfilePath -t $backendImage . 2>&1 | Select-String "(Successfully|failed|error)" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

if (Test-Path $backupIgnore) { Move-Item $backupIgnore $originalIgnore -Force }

if ($LASTEXITCODE -ne 0) {
    Write-Err "Build Docker falhou"
    Remove-Item $prodModules -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}

$imgSize = docker images $backendImage --format "{{.Size}}"
Write-OK "Imagem criada: $imgSize"

# 6. Push para Docker Hub
Write-Step "PUSH PARA DOCKER HUB"
Write-Host "  Enviando backend..." -ForegroundColor Gray
docker push $backendImage 2>&1 | Select-String "(Pushed|digest|error)" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

if ($LASTEXITCODE -eq 0) {
    Write-OK "Backend enviado com sucesso!"
} else {
    Write-Err "Push falhou"
    Remove-Item $prodModules -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}

# 7. Limpeza
Write-Step "LIMPEZA"
Remove-Item $prodModules -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $dockerfilePath -ErrorAction SilentlyContinue
Remove-Item "$backendDir\.dockerignore.minimal" -ErrorAction SilentlyContinue
Write-OK "Arquivos temporários removidos"

# 8. Resumo
Write-Step "DEPLOY BACKEND CONCLUÍDO"
Write-OK "Imagem: $backendImage ($imgSize)"
Write-Host "`n📋 Próximo passo:" -ForegroundColor Yellow
Write-Host "   1. Acesse Portainer (localhost:9443)" -ForegroundColor Gray
Write-Host "   2. Stacks → whaticket → Update the stack" -ForegroundColor Gray
Write-Host "   3. Pull and redeploy" -ForegroundColor Gray
Write-Host "`n✅ Script concluído!`n" -ForegroundColor Green
