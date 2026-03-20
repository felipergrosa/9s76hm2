@echo off
echo Iniciando servicos locais para desenvolvimento...

echo.
echo 1. Verificando Postgres...
netstat -ano | findstr ":5432" >nul
if %errorlevel% neq 0 (
    echo Postgres nao esta rodando na porta 5432
    echo Inicie o Postgres localmente ou via Docker:
    echo docker run -d --name postgres-local -p 5432:5432 -e POSTGRES_DB=whaticket -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=efe487b6a861100fb704ad9f5c160cb8 postgres:15-alpine
    pause
    exit /b 1
) else (
    echo Postgres OK: rodando na porta 5432
)

echo.
echo 2. Verificando Redis...
netstat -ano | findstr ":6379" >nul
if %errorlevel% neq 0 (
    echo Redis nao esta rodando na porta 6379
    echo Inicie o Redis localmente ou via Docker:
    echo docker run -d --name redis-local -p 6379:6379 redis:6.2-alpine
    pause
    exit /b 1
) else (
    echo Redis OK: rodando na porta 6379
)

echo.
echo 3. Todos os servicos estao OK!
echo Pode iniciar o backend com: npm run dev
pause
