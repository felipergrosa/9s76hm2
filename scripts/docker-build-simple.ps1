#!/usr/bin/env pwsh
# Build e push simples sem cache complexo

Write-Host "=== BUILD FRONTEND ===" -ForegroundColor Cyan
Set-Location frontend
docker buildx build --platform linux/amd64 --load -t felipergrosa/9s76hm2-frontend:latest .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro no build do frontend" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== BUILD BACKEND ===" -ForegroundColor Cyan
Set-Location ../backend
docker buildx build --platform linux/amd64 --load -t felipergrosa/9s76hm2-backend:latest .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro no build do backend" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== PUSH IMAGES ===" -ForegroundColor Cyan
Set-Location ..
docker push felipergrosa/9s76hm2-frontend:latest
docker push felipergrosa/9s76hm2-backend:latest

Write-Host "`n=== CONCLUÍDO ===" -ForegroundColor Green
