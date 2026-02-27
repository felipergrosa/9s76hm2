#!/usr/bin/env pwsh
# ============================================================================
# SCRIPT DE BUILD E PUSH DOCKER - SOLUÇÃO ROBUSTA PARA WINDOWS
# ============================================================================
# Evita erro EOF do buildx usando docker build padrão
# Inclui retry logic e validação de imagens
# ============================================================================

param(
    [switch]$SkipFrontend,
    [switch]$SkipBackend,
    [switch]$NoPush,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Cores para output
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

function Write-Warning { 
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow 
}

function Write-Info { 
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor White 
}

# ============================================================================
# VERIFICAÇÕES INICIAIS
# ============================================================================

Write-Step "VERIFICAÇÕES INICIAIS"

# Verificar se Docker está rodando
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker não está rodando"
        Write-Info "Execute: .\scripts\fix-docker-windows.ps1"
        exit 1
    }
    Write-Success "Docker está rodando"
} catch {
    Write-Error "Docker não está acessível"
    Write-Info "Certifique-se de que o Docker Desktop está aberto"
    exit 1
}

# Verificar login no Docker Hub
Write-Info "Verificando autenticação no Docker Hub..."
$dockerConfig = Get-Content "$env:USERPROFILE\.docker\config.json" -ErrorAction SilentlyContinue | ConvertFrom-Json
if (-not $dockerConfig.auths.'https://index.docker.io/v1/') {
    Write-Warning "Não autenticado no Docker Hub"
    Write-Info "Execute: docker login"
    $response = Read-Host "Deseja fazer login agora? (s/n)"
    if ($response -eq 's') {
        docker login
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Falha no login"
            exit 1
        }
    } else {
        Write-Error "Login necessário para fazer push"
        exit 1
    }
}
Write-Success "Autenticado no Docker Hub"

# ============================================================================
# FUNÇÃO DE BUILD COM RETRY
# ============================================================================

function Build-DockerImage {
    param(
        [string]$Context,
        [string]$Tag,
        [string]$Name,
        [int]$MaxRetries = 2
    )
    
    Write-Step "BUILD $Name"
    
    $attempt = 0
    $success = $false
    
    while (-not $success -and $attempt -lt $MaxRetries) {
        $attempt++
        
        if ($attempt -gt 1) {
            Write-Warning "Tentativa $attempt de $MaxRetries..."
            Start-Sleep -Seconds 5
        }
        
        try {
            Write-Info "Compilando $Name... (pode levar 5-10 minutos)"
            
            # Usar docker build padrão (SEM buildx) - mais estável no Windows
            $buildOutput = docker build -t $Tag $Context 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "$Name compilado com sucesso!"
                
                # Verificar se a imagem foi criada
                $imageExists = docker images $Tag -q
                if ($imageExists) {
                    Write-Success "Imagem $Tag verificada"
                    $success = $true
                } else {
                    Write-Error "Imagem não foi criada corretamente"
                    if ($attempt -eq $MaxRetries) {
                        throw "Build falhou após $MaxRetries tentativas"
                    }
                }
            } else {
                Write-Error "Erro no build (exit code: $LASTEXITCODE)"
                
                # Mostrar últimas linhas do erro
                $errorLines = $buildOutput | Select-Object -Last 20
                Write-Host "`nÚltimas linhas do erro:" -ForegroundColor Yellow
                $errorLines | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
                
                if ($attempt -eq $MaxRetries) {
                    throw "Build falhou após $MaxRetries tentativas"
                }
            }
        } catch {
            Write-Error "Exceção durante build: $_"
            if ($attempt -eq $MaxRetries) {
                throw
            }
        }
    }
    
    return $success
}

# ============================================================================
# FUNÇÃO DE PUSH COM RETRY
# ============================================================================

function Push-DockerImage {
    param(
        [string]$Tag,
        [string]$Name,
        [int]$MaxRetries = 3
    )
    
    Write-Step "PUSH $Name"
    
    $attempt = 0
    $success = $false
    
    while (-not $success -and $attempt -lt $MaxRetries) {
        $attempt++
        
        if ($attempt -gt 1) {
            Write-Warning "Tentativa $attempt de $MaxRetries..."
            Start-Sleep -Seconds 3
        }
        
        try {
            Write-Info "Enviando $Name para Docker Hub..."
            
            docker push $Tag
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "$Name enviado com sucesso!"
                $success = $true
            } else {
                Write-Error "Erro no push (exit code: $LASTEXITCODE)"
                if ($attempt -eq $MaxRetries) {
                    throw "Push falhou após $MaxRetries tentativas"
                }
            }
        } catch {
            Write-Error "Exceção durante push: $_"
            if ($attempt -eq $MaxRetries) {
                throw
            }
        }
    }
    
    return $success
}

# ============================================================================
# BUILD FRONTEND
# ============================================================================

if (-not $SkipFrontend) {
    try {
        $frontendSuccess = Build-DockerImage `
            -Context ".\frontend" `
            -Tag "felipergrosa/9s76hm2-frontend:latest" `
            -Name "FRONTEND"
        
        if (-not $frontendSuccess) {
            Write-Error "Build do frontend falhou"
            exit 1
        }
    } catch {
        Write-Error "Erro fatal no build do frontend: $_"
        exit 1
    }
} else {
    Write-Info "Frontend ignorado (--SkipFrontend)"
}

# ============================================================================
# BUILD BACKEND
# ============================================================================

if (-not $SkipBackend) {
    try {
        $backendSuccess = Build-DockerImage `
            -Context ".\backend" `
            -Tag "felipergrosa/9s76hm2-backend:latest" `
            -Name "BACKEND"
        
        if (-not $backendSuccess) {
            Write-Error "Build do backend falhou"
            exit 1
        }
    } catch {
        Write-Error "Erro fatal no build do backend: $_"
        exit 1
    }
} else {
    Write-Info "Backend ignorado (--SkipBackend)"
}

# ============================================================================
# PUSH IMAGENS
# ============================================================================

if (-not $NoPush) {
    Write-Step "ENVIANDO IMAGENS PARA DOCKER HUB"
    
    if (-not $SkipFrontend) {
        try {
            $pushSuccess = Push-DockerImage `
                -Tag "felipergrosa/9s76hm2-frontend:latest" `
                -Name "FRONTEND"
            
            if (-not $pushSuccess) {
                Write-Error "Push do frontend falhou"
                exit 1
            }
        } catch {
            Write-Error "Erro fatal no push do frontend: $_"
            exit 1
        }
    }
    
    if (-not $SkipBackend) {
        try {
            $pushSuccess = Push-DockerImage `
                -Tag "felipergrosa/9s76hm2-backend:latest" `
                -Name "BACKEND"
            
            if (-not $pushSuccess) {
                Write-Error "Push do backend falhou"
                exit 1
            }
        } catch {
            Write-Error "Erro fatal no push do backend: $_"
            exit 1
        }
    }
} else {
    Write-Info "Push ignorado (--NoPush)"
}

# ============================================================================
# RESUMO FINAL
# ============================================================================

Write-Step "DEPLOY CONCLUÍDO COM SUCESSO!"

Write-Host ""
Write-Host "Imagens publicadas no Docker Hub:" -ForegroundColor Green
if (-not $SkipFrontend) {
    Write-Host "  ✅ felipergrosa/9s76hm2-frontend:latest" -ForegroundColor White
}
if (-not $SkipBackend) {
    Write-Host "  ✅ felipergrosa/9s76hm2-backend:latest" -ForegroundColor White
}
Write-Host ""

if (-not $NoPush) {
    Write-Host "Próximo passo: Atualizar a stack no Portainer" -ForegroundColor Yellow
    Write-Host "  1. Acesse seu Portainer" -ForegroundColor Gray
    Write-Host "  2. Vá em Stacks > Whaticket" -ForegroundColor Gray
    Write-Host "  3. Clique em 'Update the stack' ou 'Pull and redeploy'" -ForegroundColor Gray
}

Write-Host ""
Write-Success "Processo finalizado!"
