# Validação pré-entrega — replica o que o CI faz antes de push.
# Uso:  ./scripts/validate-deliver.ps1            (backend + frontend)
#       ./scripts/validate-deliver.ps1 -Backend   (só backend)
#       ./scripts/validate-deliver.ps1 -Frontend  (só frontend)
param(
  [switch]$Backend,
  [switch]$Frontend,
  [switch]$Docker # adiciona o build docker do frontend (idêntico ao CI)
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$failures = @()

# Se nenhuma flag, roda tudo
if (-not $Backend -and -not $Frontend -and -not $Docker) {
  $Backend = $true; $Frontend = $true
}

if ($Backend) {
  Write-Host "`n=== [1/3] Backend: typecheck (tsc --noEmit) ===" -ForegroundColor Cyan
  Push-Location "$root\backend"
  npx tsc --noEmit
  if ($LASTEXITCODE -ne 0) { $failures += "backend tsc" }
  Pop-Location

  Write-Host "`n=== [2/3] Backend: migrations compilam + checagem de nomes de tabela ===" -ForegroundColor Cyan
  # Garante que toda migration referencia tableName real dos models
  node "$PSScriptRoot\check-migrations.js"
  if ($LASTEXITCODE -ne 0) { $failures += "migrations table names" }
}

if ($Frontend) {
  Write-Host "`n=== [3/3] Frontend: build de produção com CI=true (warnings viram erro, igual CRA) ===" -ForegroundColor Cyan
  Push-Location "$root\frontend"
  $env:CI = "true"
  npx craco build
  $code = $LASTEXITCODE
  Remove-Item Env:\CI
  if ($code -ne 0) { $failures += "frontend build (CI=true)" }
  Pop-Location
}

if ($Docker) {
  Write-Host "`n=== Docker: build do frontend (idêntico ao CI) ===" -ForegroundColor Cyan
  Push-Location "$root"
  docker build --build-arg REACT_APP_FRONTEND_VERSION=validate -t 9s76hm2-front-validate ./frontend
  if ($LASTEXITCODE -ne 0) { $failures += "docker build frontend" }
  Pop-Location
}

Write-Host ""
if ($failures.Count -eq 0) {
  Write-Host "VALIDACAO OK — seguro para commit/push" -ForegroundColor Green
  exit 0
} else {
  Write-Host "FALHAS: $($failures -join ', ')" -ForegroundColor Red
  exit 1
}
