#!/usr/bin/env pwsh
# Build e deploy SIMPLES sem buildx (evita erro EOF no Windows)
param(
    [switch]$SkipFrontend,
    [switch]$SkipBackend,
    [switch]$PushOnly
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

# Verificar se docker está rodando
try {
    $dockerInfo = docker info 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker não está rodando. Inicie o Docker Desktop primeiro."
        exit 1
    }
} catch {
    Write-Error "Docker não está acessível. Verifique se o Docker Desktop está aberto."
    exit 1
}

Write-Success "Docker está rodando"

# FRONTEND
if (-not $SkipFrontend -and -not $PushOnly) {
    Write-Step "BUILD FRONTEND"
    Set-Location $PSScriptRoot\..\frontend
    
    try {
        # Build usando docker padrão (sem buildx)
        Write-Host "Compilando frontend... (pode levar 3-5 minutos)" -ForegroundColor Yellow
        docker build -t felipergrosa/9s76hm2-frontend:latest .
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Frontend compilado com sucesso!"
        } else {
            Write-Error "Falha no build do frontend"
            exit 1
        }
    } catch {
        Write-Error "Erro durante build do frontend: $_"
        exit 1
    }
}

if (-not $SkipFrontend) {
    Write-Step "PUSH FRONTEND"
    try {
        docker push felipergrosa/9s76hm2-frontend:latest
        Write-Success "Frontend enviado para Docker Hub!"
    } catch {
        Write-Error "Falha ao fazer push do frontend: $_"
    }
}

# BACKEND
if (-not $SkipBackend -and -not $PushOnly) {
    Write-Step "BUILD BACKEND"
    Set-Location $PSScriptRoot\..\backend
    
    try {
        Write-Host "Compilando backend... (pode levar 5-10 minutos)" -ForegroundColor Yellow
        docker build -t felipergrosa/9s76hm2-backend:latest .
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Backend compilado com sucesso!"
        } else {
            Write-Error "Falha no build do backend"
            exit 1
        }
    } catch {
        Write-Error "Erro durante build do backend: $_"
        exit 1
    }
}

if (-not $SkipBackend) {
    Write-Step "PUSH BACKEND"
    try {
        docker push felipergrosa/9s76hm2-backend:latest
        Write-Success "Backend enviado para Docker Hub!"
    } catch {
        Write-Error "Falha ao fazer push do backend: $_"
    }
}

Write-Step "DEPLOY CONCLUÍDO!"
Write-Host "`nImagens publicadas:" -ForegroundColor Green
Write-Host "  • felipergrosa/9s76hm2-frontend:latest" -ForegroundColor White
Write-Host "  • felipergrosa/9s76hm2-backend:latest" -ForegroundColor White
Write-Host "`nPróximo passo: Atualizar a stack no Portainer!" -ForegroundColor Yellow
