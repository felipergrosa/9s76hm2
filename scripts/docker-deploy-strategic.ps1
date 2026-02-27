#!/usr/bin/env pwsh
# Build ESTRATÉGICO - copia apenas arquivos necessários para pasta temp
param(
    [switch]$SkipFrontend,
    [switch]$SkipBackend,
    [switch]$PushOnly
)

$ErrorActionPreference = "Stop"
$projectRoot = "C:\Users\feliperosa\whaticket"
$tempDir = "$env:TEMP\whaticket-build-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

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

Write-Step "BUILD ESTRATÉGICO DO WHATICKET"
Write-Host "Pasta temporária: $tempDir" -ForegroundColor Gray

# Cria pasta temp
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# === FRONTEND ===
if (-not $SkipFrontend -and -not $PushOnly) {
    Write-Step "PREPARANDO FRONTEND"
    
    $src = "$projectRoot\frontend"
    $dst = "$tempDir\frontend"
    
    # Cria estrutura
    New-Item -ItemType Directory -Path $dst -Force | Out-Null
    
    # Copia apenas arquivos necessários (excluindo node_modules, build, etc)
    Write-Host "Copiando arquivos do frontend..." -ForegroundColor Yellow
    
    # Lista de exclusões
    $excludes = @('node_modules', 'build', 'dist', '.git', '.vscode', '.idea', 
                 'npm-debug.log', 'yarn-debug.log', 'yarn-error.log',
                 '*.md', '*.txt', '*.bat', '*.sh', '*.sql', '*.json.bak')
    
    # Copia recursivamente com filtros
    Get-ChildItem $src -Recurse -File | Where-Object {
        $file = $_
        $exclude = $false
        foreach ($ex in $excludes) {
            if ($file.FullName -like "*$ex*") { $exclude = $true; break }
        }
        -not $exclude
    } | ForEach-Object {
        $targetPath = $_.FullName.Replace($src, $dst)
        $targetDir = Split-Path $targetPath -Parent
        if (-not (Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }
        Copy-Item $_.FullName $targetPath -Force
    }
    
    # Copia Dockerfile
    Copy-Item "$src\Dockerfile" "$dst\Dockerfile" -Force
    Copy-Item "$src\.dockerignore" "$dst\.dockerignore" -Force
    
    Write-Success "Frontend preparado ($(Get-ChildItem $dst -Recurse -File | Measure-Object | Select-Object -ExpandProperty Count) arquivos)"
    
    # Build
    Write-Step "BUILD FRONTEND"
    Set-Location $dst
    
    docker build -t felipergrosa/9s76hm2-frontend:latest .
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Frontend buildado!"
    } else {
        Write-Error "Falha no build do frontend"
        exit 1
    }
}

# Push Frontend
if (-not $SkipFrontend) {
    Write-Step "PUSH FRONTEND"
    docker push felipergrosa/9s76hm2-frontend:latest
    Write-Success "Frontend enviado!"
}

# === BACKEND ===
if (-not $SkipBackend -and -not $PushOnly) {
    Write-Step "PREPARANDO BACKEND"
    
    $src = "$projectRoot\backend"
    $dst = "$tempDir\backend"
    
    New-Item -ItemType Directory -Path $dst -Force | Out-Null
    
    Write-Host "Copiando arquivos do backend..." -ForegroundColor Yellow
    
    # Backend tem arquivos compilados (dist), então copiamos tudo exceto node_modules e public
    $excludes = @('node_modules', '.git', '.vscode', '.idea', 
                 'npm-debug.log', '*.log', '*.bak')
    
    Get-ChildItem $src -Recurse -File | Where-Object {
        $file = $_
        $exclude = $false
        foreach ($ex in $excludes) {
            if ($file.FullName -like "*$ex*") { $exclude = $true; break }
        }
        -not $exclude
    } | ForEach-Object {
        $targetPath = $_.FullName.Replace($src, $dst)
        $targetDir = Split-Path $targetPath -Parent
        if (-not (Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }
        Copy-Item $_.FullName $targetPath -Force
    }
    
    # Copia Dockerfile
    Copy-Item "$src\Dockerfile" "$dst\Dockerfile" -Force
    Copy-Item "$src\.dockerignore" "$dst\.dockerignore" -Force
    
    Write-Success "Backend preparado"
    
    # Build
    Write-Step "BUILD BACKEND"
    Set-Location $dst
    
    docker build -t felipergrosa/9s76hm2-backend:latest .
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Backend buildado!"
    } else {
        Write-Error "Falha no build do backend"
        exit 1
    }
}

# Push Backend
if (-not $SkipBackend) {
    Write-Step "PUSH BACKEND"
    docker push felipergrosa/9s76hm2-backend:latest
    Write-Success "Backend enviado!"
}

# Limpa temp
Write-Step "LIMPANDO"
Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
Write-Success "Pasta temporária removida"

Write-Step "DEPLOY CONCLUÍDO!"
Write-Host "`n✅ Imagens publicadas:" -ForegroundColor Green
Write-Host "   • felipergrosa/9s76hm2-frontend:latest" -ForegroundColor White
Write-Host "   • felipergrosa/9s76hm2-backend:latest" -ForegroundColor White
Write-Host "`n📋 Próximo passo: Atualizar stack no Portainer!" -ForegroundColor Yellow
