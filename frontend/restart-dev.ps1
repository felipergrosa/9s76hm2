#!/usr/bin/env pwsh
# Script para reiniciar frontend com cache limpo

$ErrorActionPreference = "Stop"

Write-Host "`n🧹 Limpando cache do frontend..." -ForegroundColor Cyan

# Parar processos node do frontend se estiverem rodando
Write-Host "Parando processos node..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { 
    $_.Path -like "*whaticket\frontend*" 
} | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2

# Limpar cache do webpack/craco
Write-Host "Removendo cache do webpack..." -ForegroundColor Yellow
if (Test-Path "node_modules\.cache") {
    Remove-Item -Recurse -Force "node_modules\.cache"
    Write-Host "✅ Cache do webpack removido" -ForegroundColor Green
}

# Limpar build anterior
Write-Host "Removendo build anterior..." -ForegroundColor Yellow
if (Test-Path "build") {
    Remove-Item -Recurse -Force "build"
    Write-Host "✅ Build anterior removido" -ForegroundColor Green
}

# Reinstalar @tailwindcss/postcss para garantir
Write-Host "`n📦 Reinstalando @tailwindcss/postcss..." -ForegroundColor Cyan
pnpm install @tailwindcss/postcss --save-dev

Write-Host "`n🚀 Iniciando frontend..." -ForegroundColor Cyan
Write-Host "Aguarde carregar (pode levar 1-2 minutos)..." -ForegroundColor Yellow
Write-Host ""

# Iniciar frontend
pnpm run start
