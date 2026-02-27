#!/usr/bin/env pwsh
# WHATICKET DEPLOY AUTOMATIZADO - v2.0
# Build e push para Docker Hub com contexto otimizado
# Requisito: Docker Desktop com Docker Hub logado

$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

# Configurações
$projectRoot = "C:\Users\feliperosa\whaticket"
$frontendImage = "felipergrosa/9s76hm2-frontend:latest"
$backendImage = "felipergrosa/9s76hm2-backend:latest"
$buildDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Cores
$Cyan = "Cyan"
$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"
$Gray = "Gray"

function Write-Banner {
    Write-Host "`n========================================" -ForegroundColor $Cyan
    Write-Host "  WHATICKET DEPLOY AUTOMATIZADO" -ForegroundColor $Cyan
    Write-Host "  $buildDate" -ForegroundColor $Gray
    Write-Host "========================================" -ForegroundColor $Cyan
}

function Write-Step {
    param([string]$Message, [string]$Number = "")
    $prefix = if ($Number) { "[$Number/4] " } else { "" }
    Write-Host "`n$prefix========================================" -ForegroundColor $Cyan
    Write-Host $Message -ForegroundColor $Cyan
    Write-Host "========================================" -ForegroundColor $Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "  ✅ $Message" -ForegroundColor $Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "  ⚠️  $Message" -ForegroundColor $Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "  ❌ $Message" -ForegroundColor $Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "  ℹ️  $Message" -ForegroundColor $Gray
}

# [1/4] Verificações iniciais
function Step-Verify {
    Write-Step "VERIFICAÇÕES INICIAIS" "1"
    
    # Verifica Docker
    try {
        docker info 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Docker não está rodando. Inicie o Docker Desktop primeiro."
            exit 1
        }
        Write-Success "Docker Desktop está rodando"
    } catch {
        Write-Error "Docker não está acessível"
        exit 1
    }
    
    # Verifica login Docker Hub
    $dockerUser = docker info 2>$null | Select-String "Username:" | ForEach-Object { ($_ -split ":")[1].Trim() }
    if ($dockerUser) {
        Write-Success "Logado no Docker Hub como: $dockerUser"
    } else {
        Write-Warning "Não detectado login no Docker Hub"
        Write-Info "Execute no terminal: docker login"
    }
    
    # Limpa builder cache se estiver muito grande
    Write-Info "Verificando build cache..."
    $cacheSize = docker system df 2>$null | Select-String "Build Cache" | ForEach-Object { ($_ -split "\s+")[2] }
    if ($cacheSize -and $cacheSize -match "GB") {
        Write-Warning "Build cache grande detectado: $cacheSize"
        Write-Info "Limpando build cache para build mais rápido..."
        docker builder prune -f 2>$null | Out-Null
        Write-Success "Cache limpo"
    }
}

# [2/4] Build Frontend
function Step-BuildFrontend {
    Write-Step "BUILD FRONTEND" "2"
    
    $frontendDir = "$projectRoot\frontend"
    
    # Cria .dockerignore temporário mais agressivo se necessário
    $dockerignorePath = "$frontendDir\.dockerignore"
    $dockerignoreBackup = "$frontendDir\.dockerignore.bak"
    
    # Backup do original
    if (Test-Path $dockerignorePath) {
        Copy-Item $dockerignorePath $dockerignoreBackup -Force
    }
    
    # Verifica node_modules
    $nodeModulesSize = if (Test-Path "$frontendDir\node_modules") { 
        (Get-ChildItem "$frontendDir\node_modules" -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1GB 
    } else { 0 }
    
    if ($nodeModulesSize -gt 1) {
        Write-Warning "node_modules grande detectado: $([math]::Round($nodeModulesSize,2)) GB"
        Write-Info "Isso pode afetar o build context"
    }
    
    # Build com contexto limitado manualmente
    Write-Info "Iniciando build do frontend..."
    Write-Info "Imagem: $frontendImage"
    
    Set-Location $frontendDir
    
    # Build usando dockerfile diretamente com contexto mínimo
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    
    try {
        docker build -t $frontendImage . 2>&1 | ForEach-Object {
            $line = $_
            if ($line -match "transferring context" -and $line -match "(GB|MB)") {
                Write-Info "Contexto: $line"
            }
            elseif ($line -notmatch "^(Step | ---> |Successfully|failed)") {
                Write-Host "    $line" -ForegroundColor $Gray
            }
        }
        
        if ($LASTEXITCODE -eq 0) {
            $sw.Stop()
            Write-Success "Frontend buildado em $([math]::Round($sw.Elapsed.TotalMinutes,1)) min"
            
            # Verifica tamanho da imagem
            $imgSize = docker images $frontendImage --format "{{.Size}}"
            Write-Info "Tamanho da imagem: $imgSize"
        } else {
            throw "Build falhou com código $LASTEXITCODE"
        }
    } catch {
        Write-Error "Falha no build do frontend: $_"
        exit 1
    }
    
    # Restore .dockerignore
    if (Test-Path $dockerignoreBackup) {
        Move-Item $dockerignoreBackup $dockerignorePath -Force
    }
}

# [3/4] Push Frontend + Build Backend
function Step-PushFrontend-BuildBackend {
    Write-Step "PUSH FRONTEND + BUILD BACKEND" "3"
    
    # Push Frontend em background
    Write-Info "Iniciando push do frontend..."
    $pushJob = Start-Job -ScriptBlock {
        param($img)
        docker push $img 2>&1
    } -ArgumentList $frontendImage
    
    # Build Backend enquanto frontend faz push
    $backendDir = "$projectRoot\backend"
    Set-Location $backendDir
    
    Write-Info "Iniciando build do backend..."
    Write-Info "Imagem: $backendImage"
    
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    
    try {
        docker build -t $backendImage . 2>&1 | ForEach-Object {
            $line = $_
            if ($line -match "transferring context" -and $line -match "(GB|MB)") {
                Write-Info "Contexto: $line"
            }
            elseif ($line -notmatch "^(Step | ---> |Successfully|failed)") {
                Write-Host "    $line" -ForegroundColor $Gray
            }
        }
        
        if ($LASTEXITCODE -eq 0) {
            $sw.Stop()
            Write-Success "Backend buildado em $([math]::Round($sw.Elapsed.TotalMinutes,1)) min"
            
            $imgSize = docker images $backendImage --format "{{.Size}}"
            Write-Info "Tamanho da imagem: $imgSize"
        } else {
            throw "Build falhou com código $LASTEXITCODE"
        }
    } catch {
        Write-Error "Falha no build do backend: $_"
        # Espera push job terminar mesmo com erro
        Stop-Job $pushJob -ErrorAction SilentlyContinue
        exit 1
    }
    
    # Espera push do frontend terminar
    Write-Info "Aguardando push do frontend completar..."
    $pushJob | Wait-Job | Out-Null
    $pushResult = Receive-Job $pushJob
    Remove-Job $pushJob
    
    if ($pushResult -match "digest|successfully" -or $LASTEXITCODE -eq 0) {
        Write-Success "Frontend enviado para Docker Hub"
    } else {
        Write-Error "Falha no push do frontend"
        Write-Info $pushResult
    }
}

# [4/4] Push Backend
function Step-PushBackend {
    Write-Step "PUSH BACKEND" "4"
    
    Write-Info "Enviando backend para Docker Hub..."
    
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    
    docker push $backendImage 2>&1 | ForEach-Object {
        if ($_ -match "(\d+\.)|digest|Pushed") {
            Write-Info $_
        }
    }
    
    if ($LASTEXITCODE -eq 0) {
        $sw.Stop()
        Write-Success "Backend enviado em $([math]::Round($sw.Elapsed.TotalSeconds,1)) seg"
    } else {
        Write-Error "Falha no push do backend"
        exit 1
    }
}

# Execução Principal
Write-Banner

try {
    Step-Verify
    Step-BuildFrontend
    Step-PushFrontend-BuildBackend
    Step-PushBackend
    
    # Resumo final
    Write-Host "`n========================================" -ForegroundColor $Green
    Write-Host "  ✅ DEPLOY CONCLUÍDO COM SUCESSO!" -ForegroundColor $Green
    Write-Host "========================================" -ForegroundColor $Green
    
    Write-Host "`n📦 Imagens publicadas:" -ForegroundColor $Cyan
    Write-Host "   • $frontendImage" -ForegroundColor White
    Write-Host "   • $backendImage" -ForegroundColor White
    
    Write-Host "`n📋 Próximo passo - Atualizar Portainer:" -ForegroundColor $Yellow
    Write-Host "   1. Acesse https://localhost:9443 (ou seu Portainer)" -ForegroundColor $Gray
    Write-Host "   2. Vá em Stacks → whaticket" -ForegroundColor $Gray
    Write-Host "   3. Clique em 'Update the stack' ou 'Pull and redeploy'" -ForegroundColor $Gray
    Write-Host "   4. As imagens :latest serão puxadas automaticamente" -ForegroundColor $Gray
    
    Write-Host "`n💡 Dica:" -ForegroundColor $Cyan
    Write-Host "   Para forçar atualização imediata sem cache:" -ForegroundColor $Gray
    Write-Host "   docker pull $frontendImage" -ForegroundColor $Gray
    Write-Host "   docker pull $backendImage" -ForegroundColor $Gray
    
} catch {
    Write-Host "`n========================================" -ForegroundColor $Red
    Write-Host "  ❌ ERRO NO DEPLOY" -ForegroundColor $Red
    Write-Host "  $_" -ForegroundColor $Red
    Write-Host "========================================" -ForegroundColor $Red
    exit 1
}

Write-Host "`n"
