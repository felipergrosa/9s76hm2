#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

console.log('🔧 Corrigindo conflito de versões do ajv...');

// Ler package.json
const packagePath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Adicionar overrides se não existir
if (!packageJson.overrides) {
  packageJson.overrides = {};
}

// Forçar versões compatíveis
packageJson.overrides = {
  ...packageJson.overrides,
  'ajv-keywords': {
    'ajv': '8.17.1'
  },
  'schema-utils': {
    'ajv': '8.17.1',
    'ajv-keywords': '5.1.0'
  },
  'file-loader': {
    'schema-utils': '^4.0.0'
  },
  'babel-loader': {
    'schema-utils': '^4.0.0'
  },
  'fork-ts-checker-webpack-plugin': {
    'schema-utils': '^4.0.0'
  }
};

// Salvar package.json
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
console.log('✅ package.json atualizado com overrides');

// Limpar e reinstalar
try {
  console.log('🧹 Limpando node_modules...');
  
  // Comando compatível com Windows e Unix
  const cleanCmd = os.platform() === 'win32' 
    ? 'rmdir /s /q node_modules && del package-lock.json'
    : 'rm -rf node_modules package-lock.json';
    
  execSync(cleanCmd, { stdio: 'inherit' });
  
  console.log('📦 Reinstalando dependências...');
  execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
  
  console.log('🔍 Verificando versões do ajv...');
  const ajvList = execSync('npm ls ajv ajv-keywords', { encoding: 'utf8' });
  console.log(ajvList);
  
  // Verificar se ainda há versões antigas
  if (ajvList.includes('3.5.2')) {
    console.log('⚠️ Ainda existem versões antigas, forçando atualização...');
    execSync('npm install ajv-keywords@latest --save-exact --legacy-peer-deps', { stdio: 'inherit' });
  }
  
  console.log('✅ Correção concluída!');
} catch (error) {
  console.error('❌ Erro durante a correção:', error.message);
  process.exit(1);
}
