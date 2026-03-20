@echo off
title Reiniciar Docker Desktop
echo.
echo ========================================
echo    Reiniciar Docker Desktop
echo ========================================
echo.

echo [1/3] Verificando status atual...
tasklist | findstr "Docker Desktop.exe" >nul
if %errorlevel% == 0 (
    echo Docker Desktop esta rodando. Parando...
    taskkill /F /IM "Docker Desktop.exe" >nul 2>&1
    taskkill /F /IM "com.docker.backend.exe" >nul 2>&1
    timeout /t 3 /nobreak >nul
) else (
    echo Docker Desktop ja esta parado.
)

echo.
echo [2/3] Limpando processos residuais...
taskkill /F /IM "docker.exe" >nul 2>&1
taskkill /F /IM "dockerd.exe" >nul 2>&1
echo OK.

echo.
echo [3/3] Iniciando Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

echo.
echo Aguardando Docker iniciar...
:wait
timeout /t 5 /nobreak >nul
docker ps >nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Docker iniciado com sucesso!
    echo.
    echo Comandos uteis:
    echo   docker ps                    - Ver containers
    echo   docker start postgres redis - Iniciar servicos
    echo   docker-compose up -d        - Subir whaticket
    echo.
    pause
) else (
    echo Aguardando...
    goto wait
)
