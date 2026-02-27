#!/usr/bin/env pwsh
# REBUILD BACKEND OTIMIZADO - v2.0
# Build local + imagem Docker mínima (resolve contexto gigante)

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
npm run build 2>&1 | Select-String "(error|tsc|Successfully)" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

if ($LASTEXITCODE -ne 0 -or -not (Test-Path "$backendDir\dist\server.js")) {
    Write-Err "Build TypeScript falhou"
    exit 1
}
Write-OK "TypeScript buildado (dist/server.js criado)"

# 2. Criar Dockerfile otimizado
Write-Step "CRIAR DOCKERFILE OTIMIZADO"

$dockerfileContent = @"
FROM node:20-bullseye-slim
WORKDIR /app
ENV NODE_ENV=production

# Dependências runtime (bash adicionado para auto-migrate.sh)
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash ffmpeg chromium git ca-certificates \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
    graphicsmagick ghostscript && \
    rm -rf /var/lib/apt/lists/*

# Copia package.json e instala APENAS production deps
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps --no-audit --no-fund && \
    npm cache clean --force && \
    apt-get purge -y git && apt-get autoremove -y

# Copia artefatos buildados localmente
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

$dockerfilePath = "$backendDir\Dockerfile.optimized"
$dockerfileContent | Out-File -FilePath $dockerfilePath -Encoding utf8
Write-OK "Dockerfile otimizado criado"

# 3. Criar .dockerignore mínimo
@"
node_modules
.docker-cache
.wwebjs_auth
.wwebjs_cache
.git
*.log
coverage
docs
"@ | Out-File -FilePath "$backendDir\.dockerignore.optimized" -Encoding utf8

# 4. Build imagem Docker
Write-Step "BUILD IMAGEM DOCKER"
Set-Location $backendDir

# Backup .dockerignore original
$originalIgnore = "$backendDir\.dockerignore"
$backupIgnore = "$backendDir\.dockerignore.bak"
if (Test-Path $originalIgnore) { Copy-Item $originalIgnore $backupIgnore -Force }
Copy-Item "$backendDir\.dockerignore.optimized" $originalIgnore -Force

Write-Host "  Buildando imagem (contexto otimizado)..." -ForegroundColor Gray
docker build -f $dockerfilePath -t $backendImage . 2>&1 | Select-String "(Successfully|failed|error|Step)" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

# Restore .dockerignore
if (Test-Path $backupIgnore) { Move-Item $backupIgnore $originalIgnore -Force }

if ($LASTEXITCODE -ne 0) {
    Write-Err "Build Docker falhou"
    exit 1
}

$imgSize = docker images $backendImage --format "{{.Size}}"
Write-OK "Imagem criada: $imgSize"

# 5. Push para Docker Hub
Write-Step "PUSH PARA DOCKER HUB"
Write-Host "  Enviando backend..." -ForegroundColor Gray
docker push $backendImage 2>&1 | Select-String "(Pushed|digest|error)" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

if ($LASTEXITCODE -eq 0) {
    Write-OK "Backend enviado com sucesso!"
} else {
    Write-Err "Push falhou"
    exit 1
}

# 6. Resumo
Write-Step "DEPLOY BACKEND CONCLUÍDO"
Write-OK "Imagem: $backendImage ($imgSize)"
Write-Host "`n📋 Próximo passo:" -ForegroundColor Yellow
Write-Host "   1. Acesse Portainer (localhost:9443)" -ForegroundColor Gray
Write-Host "   2. Stacks → whaticket → Update the stack" -ForegroundColor Gray
Write-Host "   3. A nova imagem será puxada automaticamente" -ForegroundColor Gray

# Limpa arquivos temporários
Remove-Item $dockerfilePath -ErrorAction SilentlyContinue
Remove-Item "$backendDir\.dockerignore.optimized" -ErrorAction SilentlyContinue

Write-Host "`n✅ Script concluído!`n" -ForegroundColor Green
