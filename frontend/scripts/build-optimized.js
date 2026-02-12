const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando build otimizado...');

// Backup do config original
const originalConfig = 'craco.config.js';
const optimizedConfig = 'craco.config.optimized.js';
const backupConfig = 'craco.config.backup.js';

try {
  // Fazer backup do config original
  if (fs.existsSync(originalConfig)) {
    fs.copyFileSync(originalConfig, backupConfig);
    console.log('✅ Backup do config original criado');
  }

  // Usar config otimizado
  if (fs.existsSync(optimizedConfig)) {
    fs.copyFileSync(optimizedConfig, originalConfig);
    console.log('✅ Config otimizado ativado');
  }

  // Executar build com mais memória
  console.log('🔨 Executando build...');
  const buildCommand = process.platform === 'win32' 
    ? 'set NODE_OPTIONS=--max-old-space-size=8192&& npm run build'
    : 'NODE_OPTIONS="--max-old-space-size=8192" npm run build';
  
  execSync(buildCommand, { stdio: 'inherit' });

  console.log('✅ Build concluído com sucesso!');

} catch (error) {
  console.error('❌ Erro no build:', error.message);
  process.exit(1);
} finally {
  // Restaurar config original
  if (fs.existsSync(backupConfig)) {
    fs.copyFileSync(backupConfig, originalConfig);
    fs.unlinkSync(backupConfig);
    console.log('🔄 Config original restaurado');
  }
}
