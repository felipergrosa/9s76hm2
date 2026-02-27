#!/usr/bin/env pwsh
# DEPLOY FINAL SIMPLIFICADO - v3.0
# Frontend: build local + imagem
# Backend: Dockerfile original + contexto limpo

$ErrorActionPreference = "Stop"
$projectRoot = "C:\Users\feliperosa\whaticket"
$frontendImage = "felipergrosa/9s76hm2-frontend:latest"
$backendImage = "felipergrosa/9s76hm2-backend:latest"

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-OK($msg) { Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "❌ $msg" -ForegroundColor Red }

# 1. Frontend
Write-Step "FRONTEND - Build Local"
Set-Location "$projectRoot\frontend"
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm run build | Select-String "(Compiled|error)" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
if ($LASTEXITCODE -ne 0) { Write-Err "Build frontend falhou"; exit 1 }
Write-OK "Frontend buildado"

# Cria imagem frontend
Write-Step "FRONTEND - Criar Imagem"
Set-Location $projectRoot
@"
FROM nginx:alpine
COPY frontend/build /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
"@ | Out-File Dockerfile.frontend.final -Encoding utf8

"node_modules`n.git`n*.log" | Out-File .dockerignore.final -Encoding utf8
Copy-Item .dockerignore.final frontend\.dockerignore -Force

docker build -f Dockerfile.frontend.final -t $frontendImage . | Select-String "(Successfully|error)" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
if ($LASTEXITCODE -eq 0) { Write-OK "Imagem frontend: $(docker images $frontendImage --format '{{.Size}}')" }

# 2. Backend - usa Dockerfile original
Write-Step "BACKEND - Build com Dockerfile Original"
Set-Location "$projectRoot\backend"

# Cria .dockerignore minimal que permite tudo necessário
@"
.docker-cache
.wwebjs_auth
.wwebjs_cache
coverage
*.log
.git
.vscode
.idea
"@ | Out-File .dockerignore -Force

docker build -t $backendImage . | Select-String "(Successfully|failed|error)" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
if ($LASTEXITCODE -eq 0) { Write-OK "Imagem backend: $(docker images $backendImage --format '{{.Size}}')" }

# 3. Push
Write-Step "PUSH PARA DOCKER HUB"
docker push $frontendImage | Select-String "(Pushed|digest)" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
Write-OK "Frontend enviado"

docker push $backendImage | Select-String "(Pushed|digest)" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
Write-OK "Backend enviado"

# 4. Resumo
Write-Step "DEPLOY CONCLUÍDO"
Write-OK "Imagens publicadas:"
Write-Host "   • $frontendImage" -ForegroundColor White
Write-Host "   • $backendImage" -ForegroundColor White
Write-Host "`n📋 Atualizar Portainer: localhost:9443 → Stacks → whaticket → Update" -ForegroundColor Yellow

# Limpa arquivos temporários
Remove-Item "$projectRoot\Dockerfile.frontend.final" -ErrorAction SilentlyContinue
Remove-Item "$projectRoot\.dockerignore.final" -ErrorAction SilentlyContinue
