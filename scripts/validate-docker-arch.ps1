# Validador de Arquitetura Docker - Desenvolvimento (PowerShell)
# Verifica se a configuração está correta conforme ARQUITETURA_DOCKER_DESENVOLVIMENTO.md

Write-Host "🔍 Validando arquitetura Docker..." -ForegroundColor Cyan

# 1. Verificar se postgres e redis estão na rede nobreluminarias
Write-Host "📡 Verificando rede nobreluminarias..." -NoNewline
try {
    $networkContainers = docker network inspect nobreluminarias --format "{{range .Containers}}{{.Name}} {{end}}" 2>$null
    if ($networkContainers -match "postgres" -and $networkContainers -match "redis") {
        Write-Host " ✅ OK" -ForegroundColor Green
    } else {
        Write-Host " ❌ ERRO: postgres/redis não encontrados na rede" -ForegroundColor Red
        Write-Host "   Containers encontrados: $networkContainers" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host " ❌ ERRO: Rede nobreluminarias não encontrada" -ForegroundColor Red
    exit 1
}

# 2. Verificar se postgres/redis estão rodando
Write-Host "🐘 Verificando Postgres..." -NoNewline
$postgresRunning = docker ps --format "{{.Names}}" | Select-String "^postgres$"
if ($postgresRunning) {
    Write-Host " ✅ OK" -ForegroundColor Green
} else {
    Write-Host " ❌ ERRO: Postgres não está rodando" -ForegroundColor Red
    exit 1
}

Write-Host "🔴 Verificando Redis..." -NoNewline
$redisRunning = docker ps --format "{{.Names}}" | Select-String "^redis$"
if ($redisRunning) {
    Write-Host " ✅ OK" -ForegroundColor Green
} else {
    Write-Host " ❌ ERRO: Redis não está rodando" -ForegroundColor Red
    exit 1
}

# 3. Verificar configuração do backend
Write-Host "🔧 Verificando configuração do backend..." -NoNewline
try {
    $dbHost = docker exec whaticket-backend sh -c 'node -e "console.log(process.env.DB_HOST)"' 2>$null
    $redisUri = docker exec whaticket-backend sh -c 'node -e "console.log(process.env.REDIS_URI)"' 2>$null
    
    if ($dbHost -eq "postgres" -and $redisUri -eq "redis://redis:6379/0") {
        Write-Host " ✅ OK" -ForegroundColor Green
    } else {
        Write-Host " ❌ ERRO: Configuração do backend incorreta" -ForegroundColor Red
        Write-Host "   DB_HOST atual: '$dbHost' (deveria ser 'postgres')" -ForegroundColor Red
        Write-Host "   REDIS_URI atual: '$redisUri' (deveria ser 'redis://redis:6379/0')" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host " ❌ ERRO: Não foi possível verificar configuração do backend" -ForegroundColor Red
    exit 1
}

# 4. Verificar se docker-compose.yml não tem services postgres/redis
Write-Host "📋 Verificando docker-compose.yml..." -NoNewline
$composeContent = Get-Content docker-compose.yml -Raw
if ($composeContent -match "^\s*postgres:" -or $composeContent -match "^\s*redis:") {
    Write-Host " ❌ ERRO: docker-compose.yml contém services postgres/redis" -ForegroundColor Red
    Write-Host "   postgres/redis devem ser serviços externos!" -ForegroundColor Red
    exit 1
} else {
    Write-Host " ✅ OK" -ForegroundColor Green
}

# 5. Verificar depends_on correto
Write-Host "🔗 Verificando depends_on..." -NoNewline
$dependsOnSection = (Select-String -Path docker-compose.yml -Pattern "depends_on:" -Context 0,2).Context.PostContext
if ($dependsOnSection -match "postgres" -and $dependsOnSection -match "redis") {
    Write-Host " ✅ OK" -ForegroundColor Green
} else {
    Write-Host " ⚠️  AVISO: depends_on pode não estar configurado" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Arquitetura Docker está CORRETA!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Resumo:"
Write-Host "   - Postgres: Container externo na rede nobreluminarias"
Write-Host "   - Redis: Container externo na rede nobreluminarias"  
Write-Host "   - Backend: Conectado via nomes de containers"
Write-Host "   - Frontend: Container whaticket"
Write-Host ""
Write-Host "✅ Ambiente pronto para desenvolvimento!" -ForegroundColor Green
