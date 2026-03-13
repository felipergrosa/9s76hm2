# LIMPAR ARQUIVOS DA SESSÃO BAILEYS #26

## Caminhos para verificar e deletar:

### Windows
rmdir /s /q "c:\Users\feliperosa\9s76hm2\backend\src\wbot\sessions\26"

### Ou via PowerShell
Remove-Item -Path "c:\Users\feliperosa\9s76hm2\backend\src\wbot\sessions\26" -Recurse -Force

### Linux/Mac
rm -rf "backend/src/wbot/sessions/26"

## Arquivos específicos que podem existir:
- backend/src/wbot/sessions/26/creds.json
- backend/src/wbot/sessions/26/pre-keys/*
- backend/src/wbot/sessions/26/session-*/*
- backend/src/wbot/sessions/26/app-state-sync/*

## IMPORTANTE:
- Faça backup se tiver dados importantes
- Reinicie o backend após deletar
- A nova conexão será criada do zero
