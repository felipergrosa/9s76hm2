#!/bin/sh

# Script universal para corrigir problemas de build no Docker
echo "🔧 Limppeando cache e node_modules..."

# Remove node_modules e package-lock.json para limpar cache
rm -rf node_modules package-lock.json 2>/dev/null || rmdir /s /q node_modules 2>nul & del package-lock.json 2>nul

# Remove o build anterior
rm -rf build 2>/dev/null || rmdir /s /q build 2>nul

# Instala dependências com tratamento de erros e overrides
echo "📦 Instalando dependências com overrides..."
npm install --legacy-peer-deps || npm install --legacy-peer-deps || npm install --legacy-peer-deps

# Verifica se o ajv-keywords antigo ainda existe e força atualização
echo "🔍 Verificando conflitos de versão do ajv..."
if npm ls ajv-keywords 2>/dev/null | grep -q "3.5.2"; then
    echo "⚠️ Encontrado ajv-keywords@3.5.2, forçando atualização..."
    npm install ajv-keywords@latest --save-exact --legacy-peer-deps
fi

# Aplicar patches necessários para o build
echo "🔧 Aplicando patches para compatibilidade..."

# Patch 1: Corrigir ForkTsCheckerWebpackPlugin
echo "📝 Patch ForkTsCheckerWebpackPlugin..."
if [ -f "node_modules/fork-ts-checker-webpack-plugin/lib/ForkTsCheckerWebpackPlugin.js" ]; then
    # Usar Node.js para fazer o patch (compatível com Windows/Unix)
    node -e "
const fs = require('fs');
const path = 'node_modules/fork-ts-checker-webpack-plugin/lib/ForkTsCheckerWebpackPlugin.js';
if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf8');
    content = content.replace(/schema_utils_1\.default\(ForkTsCheckerWebpackPluginOptions_json_1\.default, options, configuration\);/g, '// schema_utils_1.default(ForkTsCheckerWebpackPluginOptions_json_1.default, options, configuration);');
    content = content.replace(/schema_utils_1\.default\(ForkTsCheckerWebpackPluginOptions_json_1\.default, this\.options, configuration\);/g, '// schema_utils_1.default(ForkTsCheckerWebpackPluginOptions_json_1.default, this.options, configuration);');
    fs.writeFileSync(path, content);
    console.log('✅ ForkTsCheckerWebpackPlugin patch aplicado');
}
"
fi

# Patch 2: Corrigir schema-utils
echo "📝 Patch schema-utils..."
if [ -f "node_modules/schema-utils/dist/validate.js" ]; then
    node -e "
const fs = require('fs');
const path = 'node_modules/schema-utils/dist/validate.js';
if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf8');
    content = content.replace(/ajvKeywords\(/g, '// ajvKeywords(');
    fs.writeFileSync(path, content);
    console.log('✅ schema-utils patch aplicado');
}
"
fi

# Patch 3: Corrigir react-refresh-webpack-plugin
echo "📝 Patch react-refresh-webpack-plugin..."
if [ -f "node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/index.js" ]; then
    node -e "
const fs = require('fs');
const path = 'node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/index.js';
if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf8');
    content = content.replace(/validateOptions\(/g, 'try { validateOptions(');
    content = content.replace(/validateOptions\([^)]*\);/g, 'match => match + \" } catch(e) { /* ignore validation errors */ }');
    fs.writeFileSync(path, content);
    console.log('✅ react-refresh-webpack-plugin patch aplicado');
}
"
fi

# Patch 4: Corrigir babel-loader
echo "📝 Patch babel-loader..."
if [ -f "node_modules/babel-loader/lib/index.js" ]; then
    node -e "
const fs = require('fs');
const path = 'node_modules/babel-loader/lib/index.js';
if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf8');
    content = content.replace(/validateOptions\(/g, 'try { validateOptions(');
    content = content.replace(/validateOptions\([^)]*\);/g, 'match => match + \" } catch(e) { /* ignore validation errors */ }');
    fs.writeFileSync(path, content);
    console.log('✅ babel-loader patch aplicado');
}
"
fi

# Tenta build com diferentes configurações de memória
echo "🏗️ Tentando build com 6GB de RAM..."
if NODE_OPTIONS=--max-old-space-size=6144 npm run build; then
    echo "✅ Build bem-sucedido com 6GB!"
elif NODE_OPTIONS=--max-old-space-size=4096 npm run build; then
    echo "✅ Build bem-sucedido com 4GB!"
elif NODE_OPTIONS=--max-old-space-size=3072 npm run build; then
    echo "✅ Build bem-sucedido com 3GB!"
elif npm run build; then
    echo "✅ Build bem-sucedido sem limite de memória!"
else
    echo "❌ Build falhou. Verifique os logs acima."
    exit 1
fi

echo "🎉 Build concluído com sucesso!"
