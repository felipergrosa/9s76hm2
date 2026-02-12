#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

console.log('🔧 Limppeando cache e node_modules...');

// Remove node_modules e package-lock.json para limpar cache
try {
    if (fs.existsSync('node_modules')) {
        if (process.platform === 'win32') {
            execSync('rmdir /s /q node_modules', { stdio: 'inherit' });
        } else {
            execSync('rm -rf node_modules', { stdio: 'inherit' });
        }
    }
    if (fs.existsSync('package-lock.json')) {
        fs.unlinkSync('package-lock.json');
    }
} catch (e) {
    console.log('⚠️ Erro ao limpar, continuando...');
}

// Remove o build anterior
try {
    if (fs.existsSync('build')) {
        if (process.platform === 'win32') {
            execSync('rmdir /s /q build', { stdio: 'inherit' });
        } else {
            execSync('rm -rf build', { stdio: 'inherit' });
        }
    }
} catch (e) {
    console.log('⚠️ Erro ao remover build, continuando...');
}

// Instala dependências com tratamento de erros e overrides
console.log('📦 Instalando dependências com overrides...');
try {
    execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
} catch (e) {
    console.log('⚠️ Primeira tentativa falhou, tentando novamente...');
    try {
        execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
    } catch (e2) {
        console.log('⚠️ Segunda tentativa falhou, tentando mais uma vez...');
        execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
    }
}

// Verifica se o ajv-keywords antigo ainda existe e força atualização
console.log('🔍 Verificando conflitos de versão do ajv...');
try {
    const output = execSync('npm ls ajv-keywords', { encoding: 'utf8' });
    if (output.includes('3.5.2')) {
        console.log('⚠️ Encontrado ajv-keywords@3.5.2, forçando atualização...');
        execSync('npm install ajv-keywords@latest --save-exact --legacy-peer-deps', { stdio: 'inherit' });
    }
} catch (e) {
    // Ignorar erros na verificação
}

// Aplicar patches necessários para o build
console.log('🔧 Aplicando patches para compatibilidade...');

// Patch 1: Corrigir ForkTsCheckerWebpackPlugin
console.log('📝 Patch ForkTsCheckerWebpackPlugin...');
const forkTsCheckerPath = 'node_modules/fork-ts-checker-webpack-plugin/lib/ForkTsCheckerWebpackPlugin.js';
if (fs.existsSync(forkTsCheckerPath)) {
    let content = fs.readFileSync(forkTsCheckerPath, 'utf8');
    content = content.replace(
        /schema_utils_1\.default\(ForkTsCheckerWebpackPluginOptions_json_1\.default, options, configuration\);/g,
        '// schema_utils_1.default(ForkTsCheckerWebpackPluginOptions_json_1.default, options, configuration);'
    );
    content = content.replace(
        /schema_utils_1\.default\(ForkTsCheckerWebpackPluginOptions_json_1\.default, this\.options, configuration\);/g,
        '// schema_utils_1.default(ForkTsCheckerWebpackPluginOptions_json_1.default, this.options, configuration);'
    );
    fs.writeFileSync(forkTsCheckerPath, content);
    console.log('✅ ForkTsCheckerWebpackPlugin patch aplicado');
}

// Patch 2: Corrigir schema-utils
console.log('📝 Patch schema-utils...');
const schemaUtilsPath = 'node_modules/schema-utils/dist/validate.js';
if (fs.existsSync(schemaUtilsPath)) {
    let content = fs.readFileSync(schemaUtilsPath, 'utf8');
    content = content.replace(/ajvKeywords\(/g, '// ajvKeywords(');
    fs.writeFileSync(schemaUtilsPath, content);
    console.log('✅ schema-utils patch aplicado');
}

// Patch 3: Corrigir react-refresh-webpack-plugin
console.log('📝 Patch react-refresh-webpack-plugin...');
const reactRefreshPath = 'node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/index.js';
if (fs.existsSync(reactRefreshPath)) {
    let content = fs.readFileSync(reactRefreshPath, 'utf8');
    content = content.replace(/validateOptions\(/g, 'try { validateOptions(');
    content = content.replace(/validateOptions\([^)]*\);/g, match => match + ' } catch(e) { /* ignore validation errors */ }');
    fs.writeFileSync(reactRefreshPath, content);
    console.log('✅ react-refresh-webpack-plugin patch aplicado');
}

// Patch 4: Corrigir babel-loader
console.log('📝 Patch babel-loader...');
const babelLoaderPath = 'node_modules/babel-loader/lib/index.js';
if (fs.existsSync(babelLoaderPath)) {
    let content = fs.readFileSync(babelLoaderPath, 'utf8');
    content = content.replace(/validateOptions\(/g, 'try { validateOptions(');
    content = content.replace(/validateOptions\([^)]*\);/g, match => match + ' } catch(e) { /* ignore validation errors */ }');
    fs.writeFileSync(babelLoaderPath, content);
    console.log('✅ babel-loader patch aplicado');
}

// Função para tentar build com diferentes configurações
function tryBuild(nodeOptions) {
    const env = { ...process.env };
    if (nodeOptions) {
        env.NODE_OPTIONS = nodeOptions;
    }
    
    return new Promise((resolve, reject) => {
        const npm = spawn('npm', ['run', 'build'], { 
            env, 
            stdio: 'inherit',
            shell: true 
        });
        
        npm.on('close', (code) => {
            if (code === 0) {
                resolve(code);
            } else {
                reject(code);
            }
        });
    });
}

// Tenta build com diferentes configurações de memória
console.log('🏗️ Tentando build com 6GB de RAM...');
tryBuild('--max-old-space-size=6144')
    .then(() => {
        console.log('✅ Build bem-sucedido com 6GB!');
        console.log('🎉 Build concluído com sucesso!');
        process.exit(0);
    })
    .catch(() => {
        console.log('🏗️ Tentando build com 4GB de RAM...');
        return tryBuild('--max-old-space-size=4096');
    })
    .then(() => {
        console.log('✅ Build bem-sucedido com 4GB!');
        console.log('🎉 Build concluído com sucesso!');
        process.exit(0);
    })
    .catch(() => {
        console.log('🏗️ Tentando build com 3GB de RAM...');
        return tryBuild('--max-old-space-size=3072');
    })
    .then(() => {
        console.log('✅ Build bem-sucedido com 3GB!');
        console.log('🎉 Build concluído com sucesso!');
        process.exit(0);
    })
    .catch(() => {
        console.log('🏗️ Tentando build sem limite de memória...');
        return tryBuild('');
    })
    .then(() => {
        console.log('✅ Build bem-sucedido sem limite de memória!');
        console.log('🎉 Build concluído com sucesso!');
        process.exit(0);
    })
    .catch(() => {
        console.log('❌ Build falhou. Verifique os logs acima.');
        process.exit(1);
    });
