#!/usr/bin/env pwsh
# Build e deploy OTIMIZADO para Windows (sem contexto gigante)
param(
    [switch]$SkipFrontend,
    [switch]$SkipBackend,
    [switch]$PushOnly
)

$ErrorActionPreference = "Stop"
$projectRoot = "C:\Users\feliperosa\whaticket"

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

# Verificar Docker
Write-Step "VERIFICANDO DOCKER"
try {
    docker info 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker não está rodando. Inicie o Docker Desktop primeiro."
        exit 1
    }
    Write-Success "Docker está rodando"
} catch {
    Write-Error "Docker não está acessível."
    exit 1
}

# FRONTEND - Build otimizado com contexto limitado
if (-not $SkipFrontend -and -not $PushOnly) {
    Write-Step "BUILD FRONTEND (Otimizado)"
    
    $frontendDir = "$projectRoot\frontend"
    Set-Location $frontendDir
    
    try {
        Write-Host "Compilando frontend... (estimado: 3-5 min)" -ForegroundColor Yellow
        
        # Build usando contexto apenas da pasta frontend
        docker build -t felipergrosa/9s76hm2-frontend:latest .
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Frontend compilado!"
        } else {
            Write-Error "Falha no build do frontend"
            exit 1
        }
    } catch {
        Write-Error "Erro: $_"
        exit 1
    }
}

# Push Frontend
if (-not $SkipFrontend) {
    Write-Step "PUSH FRONTEND"
    try {
        docker push felipergrosa/9s76hm2-frontend:latest
        Write-Success "Frontend enviado!"
    } catch {
        Write-Error "Falha no push: $_"
    }
}

# BACKEND - Build otimizado
if (-not $SkipBackend -and -not $PushOnly) {
    Write-Step "BUILD BACKEND (Otimizado)"
    
    $backendDir = "$projectRoot\backend"
    Set-Location $backendDir
    
    try {
        Write-Host "Compilando backend... (estimado: 5-10 min)" -ForegroundColor Yellow
        
        # Build usando contexto apenas da pasta backend
        docker build -t felipergrosa/9s76hm2-backend:latest .
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Backend compilado!"
        } else {
            Write-Error "Falha no build do backend"
            exit 1
        }
    } catch {
        Write-Error "Erro: $_"
        exit 1
    }
}

# Push Backend
if (-not $SkipBackend) {
    Write-Step "PUSH BACKEND"
    try {
        docker push felipergrosa/9s76hm2-backend:latest
        Write-Success "Backend enviado!"
    } catch {
        Write-Error "Falha no push: $_"
    }
}

Write-Step "DEPLOY CONCLUÍDO!"
Write-Host "`n✅ Imagens publicadas:" -ForegroundColor Green
Write-Host "   • felipergrosa/9s76hm2-frontend:latest" -ForegroundColor White
Write-Host "   • felipergrosa/9s76hm2-backend:latest" -ForegroundColor White
Write-Host "`n📋 Próximo passo: Atualizar stack no Portainer!" -ForegroundColor Yellow
Write-Host "   1. Acesse https://localhost:9000" -ForegroundColor Gray
Write-Host "   2. Vá em Stacks → whaticket" -ForegroundColor Gray
Write-Host "   3. Click 'Update the stack'" -ForegroundColor Gray
Write-Host "   4. As imagens :latest serão puxadas automaticamente" -ForegroundColor Gray
