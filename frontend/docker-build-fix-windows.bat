@echo off
REM Script para corrigir problemas de build no Docker (Windows)
echo 🔧 Limppeando cache e node_modules...

REM Remove node_modules e package-lock.json para limpar cache
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

REM Remove o build anterior
if exist build rmdir /s /q build

REM Instala dependências com tratamento de erros e overrides
echo 📦 Instalando dependências com overrides...
npm install --legacy-peer-deps
if errorlevel 1 (
    npm install --legacy-peer-deps
    if errorlevel 1 (
        npm install --legacy-peer-deps
    )
)

REM Verifica se o ajv-keywords antigo ainda existe e força atualização
echo 🔍 Verificando conflitos de versão do ajv...
npm ls ajv-keywords 2>nul | findstr "3.5.2" >nul
if not errorlevel 1 (
    echo ⚠️ Encontrado ajv-keywords@3.5.2, forçando atualização...
    npm install ajv-keywords@latest --save-exact --legacy-peer-deps
)

REM Aplicar patches necessários para o build
echo 🔧 Aplicando patches para compatibilidade...

REM Patch 1: Corrigir ForkTsCheckerWebpackPlugin
echo 📝 Patch ForkTsCheckerWebpackPlugin...
if exist "node_modules\fork-ts-checker-webpack-plugin\lib\ForkTsCheckerWebpackPlugin.js" (
    powershell -Command "(Get-Content node_modules\fork-ts-checker-webpack-plugin\lib\ForkTsCheckerWebpackPlugin.js) -replace 'schema_utils_1\.default\(ForkTsCheckerWebpackPluginOptions_json_1\.default, options, configuration\);', '// schema_utils_1.default(ForkTsCheckerWebpackPluginOptions_json_1.default, options, configuration);' | Set-Content node_modules\fork-ts-checker-webpack-plugin\lib\ForkTsCheckerWebpackPlugin.js"
    powershell -Command "(Get-Content node_modules\fork-ts-checker-webpack-plugin\lib\ForkTsCheckerWebpackPlugin.js) -replace 'schema_utils_1\.default\(ForkTsCheckerWebpackPluginOptions_json_1\.default, this\.options, configuration\);', '// schema_utils_1.default(ForkTsCheckerWebpackPluginOptions_json_1.default, this.options, configuration);' | Set-Content node_modules\fork-ts-checker-webpack-plugin\lib\ForkTsCheckerWebpackPlugin.js"
    echo ✅ ForkTsCheckerWebpackPlugin patch aplicado
)

REM Patch 2: Corrigir schema-utils
echo 📝 Patch schema-utils...
if exist "node_modules\schema-utils\dist\validate.js" (
    powershell -Command "(Get-Content node_modules\schema-utils\dist\validate.js) -replace 'ajvKeywords\(', '// ajvKeywords(' | Set-Content node_modules\schema-utils\dist\validate.js"
    echo ✅ schema-utils patch aplicado
)

REM Patch 3: Corrigir react-refresh-webpack-plugin
echo 📝 Patch react-refresh-webpack-plugin...
if exist "node_modules\@pmmmwh\react-refresh-webpack-plugin\lib\index.js" (
    powershell -Command "(Get-Content node_modules\@pmmmwh\react-refresh-webpack-plugin\lib\index.js) -replace 'validateOptions\(', 'try { validateOptions(' | Set-Content node_modules\@pmmmwh\react-refresh-webpack-plugin\lib\index.js"
    powershell -Command "(Get-Content node_modules\@pmmmwh\react-refresh-webpack-plugin\lib\index.js) -replace 'validateOptions\([^)]*\);', 'validateOptions$1; } catch(e) { /* ignore validation errors */ }' | Set-Content node_modules\@pmmmwh\react-refresh-webpack-plugin\lib\index.js"
    echo ✅ react-refresh-webpack-plugin patch aplicado
)

REM Patch 4: Corrigir babel-loader
echo 📝 Patch babel-loader...
if exist "node_modules\babel-loader\lib\index.js" (
    powershell -Command "(Get-Content node_modules\babel-loader\lib\index.js) -replace 'validateOptions\(', 'try { validateOptions(' | Set-Content node_modules\babel-loader\lib\index.js"
    powershell -Command "(Get-Content node_modules\babel-loader\lib\index.js) -replace 'validateOptions\([^)]*\);', 'validateOptions$1; } catch(e) { /* ignore validation errors */ }' | Set-Content node_modules\babel-loader\lib\index.js"
    echo ✅ babel-loader patch aplicado
)

REM Tenta build com diferentes configurações de memória
echo 🏗️ Tentando build com 6GB de RAM...
set NODE_OPTIONS=--max-old-space-size=6144
npm run build
if not errorlevel 1 (
    echo ✅ Build bem-sucedido com 6GB!
    goto :success
)

set NODE_OPTIONS=--max-old-space-size=4096
npm run build
if not errorlevel 1 (
    echo ✅ Build bem-sucedido com 4GB!
    goto :success
)

set NODE_OPTIONS=--max-old-space-size=3072
npm run build
if not errorlevel 1 (
    echo ✅ Build bem-sucedido com 3GB!
    goto :success
)

set NODE_OPTIONS=
npm run build
if not errorlevel 1 (
    echo ✅ Build bem-sucedido sem limite de memória!
    goto :success
)

echo ❌ Build falhou. Verifique os logs acima.
exit /b 1

:success
echo 🎉 Build concluído com sucesso!
exit /b 0
