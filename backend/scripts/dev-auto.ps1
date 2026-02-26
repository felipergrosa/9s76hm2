# ========================================
# Script Automatizado de Desenvolvimento
# ========================================
# Gerencia ambiente dev sem derrubar Docker
# Resolve conflitos automaticamente

param(
    [switch]$Verbose
)

$ErrorActionPreference = "SilentlyContinue"

function Write-Step {
    param([string]$Message, [string]$Color = "Cyan")
    Write-Host "🔧 $Message" -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

# ========================================
# 1. Verificar Docker
# ========================================
Write-Step "Verificando Docker Desktop..."

$dockerRunning = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
if (-not $dockerRunning) {
    Write-Warning "Docker Desktop não está rodando"
    Write-Step "Iniciando Docker Desktop..."
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    Write-Step "Aguardando Docker inicializar (30s)..."
    Start-Sleep -Seconds 30
}

# Testar se Docker daemon está acessível
$dockerAccessible = $false
for ($i = 1; $i -le 5; $i++) {
    try {
        docker ps 2>$null | Out-Null
        $dockerAccessible = $true
        break
    } catch {
        if ($i -lt 5) {
            Write-Step "Docker daemon não acessível, tentativa $i/5..."
            Start-Sleep -Seconds 3
        }
    }
}

if (-not $dockerAccessible) {
    Write-Error "Docker daemon não está acessível após 5 tentativas"
    Write-Warning "Tente reiniciar o Docker Desktop manualmente"
    exit 1
}

Write-Success "Docker acessível"

# ========================================
# 2. Gerenciar Container Backend
# ========================================
Write-Step "Verificando container backend..."

$backendContainer = docker ps -a --filter "name=whaticket-backend" --format "{{.Names}}:{{.Status}}" 2>$null

if ($backendContainer) {
    if ($backendContainer -match "Up") {
        Write-Warning "Container backend está rodando - parando para evitar conflito de porta..."
        docker stop whaticket-backend 2>$null | Out-Null
        Start-Sleep -Seconds 2
        Write-Success "Container backend parado"
    } else {
        Write-Success "Container backend já está parado"
    }
} else {
    Write-Success "Container backend não existe (OK para dev local)"
}

# ========================================
# 3. Garantir PostgreSQL e Redis
# ========================================
Write-Step "Verificando PostgreSQL e Redis..."

$postgresStatus = docker ps --filter "name=postgres" --format "{{.Status}}" 2>$null
$redisStatus = docker ps --filter "name=redis" --format "{{.Status}}" 2>$null

if (-not $postgresStatus -or $postgresStatus -notmatch "Up") {
    Write-Step "Iniciando PostgreSQL..."
    docker start postgres 2>$null | Out-Null
    Start-Sleep -Seconds 3
}

if (-not $redisStatus -or $redisStatus -notmatch "Up") {
    Write-Step "Iniciando Redis..."
    docker start whaticket-redis 2>$null | Out-Null
    Start-Sleep -Seconds 2
}

Write-Success "PostgreSQL e Redis rodando"

# ========================================
# 4. Verificar Porta 8080 (com retry e netstat)
# ========================================
Write-Step "Verificando porta 8080..."

# Tentar até 3 vezes para garantir que a porta está livre
for ($attempt = 1; $attempt -le 3; $attempt++) {
    # Usar netstat para detectar processo usando a porta
    $netstatOutput = netstat -ano | Select-String ":8080.*LISTENING"
    
    if ($netstatOutput) {
        Write-Warning "Porta 8080 em uso (tentativa $attempt/3) - liberando..."
        
        # Extrair PID do netstat
        $matches = $netstatOutput | Select-String "\s(\d+)$"
        if ($matches) {
            $pid = $matches.Matches[0].Groups[1].Value
            try {
                $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
                if ($proc -and $proc.ProcessName -ne "Idle") {
                    Write-Step "Finalizando processo $($proc.ProcessName) (PID: $pid)..."
                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                }
            } catch {
                # Ignorar erros silenciosamente
            }
        }
        
        # Aguardar para garantir que o processo foi finalizado
        Start-Sleep -Seconds 2
        
        # Tentar matar todos os processos node/ts-node que possam estar usando a porta
        Get-Process -Name node,ts-node-dev -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
        
        # Verificar novamente
        $stillInUse = netstat -ano | Select-String ":8080.*LISTENING"
        if (-not $stillInUse) {
            Write-Success "Porta 8080 liberada"
            break
        }
    } else {
        Write-Success "Porta 8080 disponível"
        break
    }
    
    if ($attempt -eq 3) {
        Write-Error "Não foi possível liberar a porta 8080 após 3 tentativas"
        Write-Warning "Saída do netstat:"
        netstat -ano | Select-String ":8080" | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
        exit 1
    }
}

# Aguardar adicionalmente para garantir que o sistema operacional liberou a porta
Write-Step "Aguardando sistema operacional liberar porta..."

# Loop para garantir que a porta está realmente livre
for ($wait = 1; $wait -le 10; $wait++) {
    $stillListening = netstat -ano | Select-String ":8080.*LISTENING"
    if (-not $stillListening) {
        Write-Success "Porta 8080 liberada (aguardou ${wait}s)"
        break
    }
    if ($wait -eq 10) {
        Write-Error "Porta 8080 ainda está em uso após 10 segundos"
        Write-Warning "Processos usando a porta:"
        netstat -ano | Select-String ":8080" | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
        exit 1
    }
    Start-Sleep -Seconds 1
}

# ========================================
# 5. Testar Conexão PostgreSQL
# ========================================
Write-Step "Testando conexão com PostgreSQL..."

$pgConnected = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue

if (-not $pgConnected) {
    Write-Error "PostgreSQL não está acessível na porta 5432"
    Write-Warning "Tentando reiniciar container..."
    docker restart postgres 2>$null | Out-Null
    Start-Sleep -Seconds 5
    
    $pgConnected = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue
    
    if (-not $pgConnected) {
        Write-Error "PostgreSQL ainda não está acessível"
        Write-Warning "Verifique o container: docker logs postgres"
        exit 1
    }
}

Write-Success "PostgreSQL acessível na porta 5432"

# ========================================
# 6. Testar Conexão Redis
# ========================================
Write-Step "Testando conexão com Redis..."

$redisConnected = Test-NetConnection -ComputerName localhost -Port 6379 -InformationLevel Quiet -WarningAction SilentlyContinue

if (-not $redisConnected) {
    Write-Warning "Redis não está acessível - tentando reiniciar..."
    docker restart whaticket-redis 2>$null | Out-Null
    Start-Sleep -Seconds 3
}

Write-Success "Redis acessível na porta 6379"

# ========================================
# 7. Limpar node_modules/.cache se necessário
# ========================================
if (Test-Path "node_modules/.cache") {
    Write-Step "Limpando cache do TypeScript..."
    Remove-Item -Recurse -Force "node_modules/.cache" -ErrorAction SilentlyContinue
}

# ========================================
# 8. Resumo do Ambiente
# ========================================
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  AMBIENTE DE DESENVOLVIMENTO PRONTO" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "  🐘 PostgreSQL:  " -NoNewline -ForegroundColor Cyan
Write-Host "localhost:5432" -ForegroundColor White
Write-Host "  🔴 Redis:       " -NoNewline -ForegroundColor Cyan
Write-Host "localhost:6379" -ForegroundColor White
Write-Host "  🚀 Backend:     " -NoNewline -ForegroundColor Cyan
Write-Host "localhost:8080 (local)" -ForegroundColor White
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# ========================================
# 9. Iniciar Backend Local
# ========================================
Write-Step "Iniciando backend local..." "Green"
Write-Host ""

# Executar pnpm run dev (sem o script de kill port, já fizemos isso)
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Erro na compilação TypeScript"
    exit 1
}

npx sequelize db:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Erro nas migrations (continuando mesmo assim)"
}

# Iniciar ts-node-dev
ts-node-dev --respawn --transpile-only src/server.ts
