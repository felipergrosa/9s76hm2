# Script para reiniciar Docker Desktop - Windows PowerShell
# Uso: .\restart-docker.ps1

Write-Host "🔄 Reiniciando Docker Desktop..." -ForegroundColor Cyan

# Função para verificar se Docker está rodando
function Test-DockerRunning {
    try {
        docker ps 2>$null | Out-Null
        return $?
    } catch {
        return $false
    }
}

# 1. Verificar se Docker Desktop está rodando
Write-Host "📊 Verificando status atual do Docker..." -NoNewline
if (Test-DockerRunning) {
    Write-Host " ✅ Rodando" -ForegroundColor Green
    Write-Host "🛑 Parando Docker Desktop..." -NoNewline
    
    # Tentar parar gracefully
    try {
        & "C:\Program Files\Docker\Docker\Docker Desktop.exe" --quit 2>$null
        
        # Aguardar parar
        $timeout = 30
        $timer = 0
        while (Test-DockerRunning -and $timer -lt $timeout) {
            Start-Sleep -Seconds 1
            $timer++
            Write-Host "." -NoNewline
        }
        
        if (Test-DockerRunning) {
            Write-Host " ⚠️ Timeout, forçando parada" -ForegroundColor Yellow
            # Forçar parada
            taskkill /F /IM "Docker Desktop.exe" 2>$null | Out-Null
            taskkill /F /IM "com.docker.backend.exe" 2>$null | Out-Null
        } else {
            Write-Host " ✅ Parado" -ForegroundColor Green
        }
    } catch {
        Write-Host " ⚠️ Erro ao parar, forçando..." -ForegroundColor Yellow
        taskkill /F /IM "Docker Desktop.exe" 2>$null | Out-Null
        taskkill /F /IM "com.docker.backend.exe" 2>$null | Out-Null
    }
} else {
    Write-Host " ❌ Parado" -ForegroundColor Red
}

# 2. Limpar processos residuais
Write-Host "🧹 Limpando processos residuais..." -NoNewline
taskkill /F /IM "docker.exe" 2>$null | Out-Null
taskkill /F /IM "dockerd.exe" 2>$null | Out-Null
Write-Host " ✅ OK" -ForegroundColor Green

# 3. Iniciar Docker Desktop
Write-Host "🚀 Iniciando Docker Desktop..." -NoNewline
try {
    Start-Process -FilePath "C:\Program Files\Docker\Docker\Docker Desktop.exe" -WindowStyle Hidden
    
    # Aguardar iniciar
    $timeout = 60
    $timer = 0
    while (-not (Test-DockerRunning) -and $timer -lt $timeout) {
        Start-Sleep -Seconds 2
        $timer++
        Write-Host "." -NoNewline
    }
    
    if (Test-DockerRunning) {
        Write-Host " ✅ Docker iniciado!" -ForegroundColor Green
    } else {
        Write-Host " ❌ Timeout ao iniciar" -ForegroundColor Red
        Write-Host "💡 Dica: Verifique se Docker Desktop está instalado corretamente" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host " ❌ Erro ao iniciar Docker Desktop" -ForegroundColor Red
    Write-Host "💡 Dica: Verifique se Docker Desktop está instalado em 'C:\Program Files\Docker\Docker\Docker Desktop.exe'" -ForegroundColor Yellow
    exit 1
}

# 4. Verificar containers anteriores
Write-Host "📋 Verificando containers anteriores..." -NoNewline
$containers = docker ps -a --format "table {{.Names}}\t{{.Status}}" 2>$null
if ($containers) {
    Write-Host " ✅ Encontrados" -ForegroundColor Green
    Write-Host ""
    Write-Host "📦 Containers disponíveis:" -ForegroundColor Cyan
    Write-Host $containers
    Write-Host ""
    
    # Verificar se containers principais existem
    $postgresExists = docker ps -a --format "{{.Names}}" | Select-String "^postgres$"
    $redisExists = docker ps -a --format "{{.Names}}" | Select-String "^redis$"
    
    if ($postgresExists -and $redisExists) {
        Write-Host "🎯 Containers postgres e redis encontrados" -ForegroundColor Green
        Write-Host "💡 Para iniciar: docker start postgres redis" -ForegroundColor Cyan
    } else {
        Write-Host "⚠️ Containers postgres/redis não encontrados" -ForegroundColor Yellow
        Write-Host "💡 Para criar: consulte docs/privado/ARQUITETURA_DOCKER_DESENVOLVIMENTO.md" -ForegroundColor Cyan
    }
} else {
    Write-Host " ❌ Nenhum container encontrado" -ForegroundColor Red
}

# 5. Comandos úteis
Write-Host ""
Write-Host "🔧 Comandos úteis:" -ForegroundColor Cyan
Write-Host "   docker ps                    - Ver containers rodando"
Write-Host "   docker ps -a                - Ver todos containers"
Write-Host "   docker start postgres redis  - Iniciar serviços"
Write-Host "   docker-compose up -d         - Subir whaticket"
Write-Host "   pnpm run dev                 - Iniciar backend local"
Write-Host ""

Write-Host "🎉 Docker Desktop reiniciado com sucesso!" -ForegroundColor Green
