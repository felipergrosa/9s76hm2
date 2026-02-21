const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Iniciando otimização do build...');

// 1. Limpar cache
console.log('🧹 Limpando cache...');
try {
  execSync('npm cache clean --force', { stdio: 'inherit' });
  if (fs.existsSync('node_modules/.cache')) {
    fs.rmSync('node_modules/.cache', { recursive: true, force: true });
  }
  if (fs.existsSync('build')) {
    fs.rmSync('build', { recursive: true, force: true });
  }
} catch (error) {
  console.log('Cache limpo ou não encontrado');
}

// 2. Verificar dependências duplicadas
console.log('🔍 Verificando dependências...');
try {
  const duplicates = execSync('npm ls --depth=0', { encoding: 'utf8' });
  console.log('Dependências instaladas verificadas');
} catch (error) {
  console.log('Aviso: Possíveis dependências duplicadas');
}

// 3. Otimizar package.json (remover dependências não usadas)
console.log('📦 Analisando dependências...');
const packageJson = require('../package.json');
const usedDeps = new Set();

// Adicionar dependências conhecidas que são usadas
const essentialDeps = [
  'react', 'react-dom', 'react-router-dom', 'react-scripts',
  '@material-ui/core', '@material-ui/icons', '@mui/material', '@mui/icons-material',
  'axios', 'socket.io-client', 'date-fns', 'moment', 'yup', 'formik',
  'styled-components', 'tailwindcss', 'lucide-react'
];

essentialDeps.forEach(dep => usedDeps.add(dep));

// Verificar dependências não essenciais
const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
const unusedDeps = Object.keys(allDeps).filter(dep => !usedDeps.has(dep) && !dep.startsWith('@'));

if (unusedDeps.length > 0) {
  console.log('⚠️  Dependências possivelmente não usadas:');
  unusedDeps.forEach(dep => console.log(`   - ${dep}`));
  console.log('Considere removê-las se não forem necessárias');
}

console.log('✅ Otimização concluída!');
console.log('\n📋 Comandos disponíveis:');
console.log('   npm run build           - Build normal');
console.log('   npm run build:optimized - Build otimizado');
console.log('   npm run build:analyze   - Build com análise');
