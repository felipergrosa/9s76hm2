/**
 * Script para verificar se o Docker Desktop está funcionando ANTES de iniciar o backend
 * 
 * Este script é executado ANTES de npm run dev e verifica rapidamente se o Docker Desktop
 * está funcionando. Se não estiver, alerta o usuário e encerra.
 * 
 * Para corrigir automaticamente, execute: npm run docker:fix
 */

const { execSync } = require('child_process');
const fs = require('fs');

// Verifica se um pipe existe
function pipeExists(pipePath) {
  try {
    fs.accessSync(pipePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// Verifica se a porta do postgres está acessível
function checkPostgresPort() {
  try {
    const result = execSync(
      `powershell -Command "(Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet).ToString()"`,
      { encoding: 'utf8', timeout: 15000 }
    );
    return result.trim().toLowerCase() === 'true';
  } catch {
    return false;
  }
}

// Função principal - SINCRONA para funcionar com && no npm run dev
function main() {
  // Verifica se está no Windows
  if (process.platform !== 'win32') {
    // Não é Windows, não precisa verificar Docker Desktop
    return;
  }
  
  console.log('');
  console.log('🔍 Verificando Docker Desktop...');
  
  // Verificações rápidas
  const pipePath = '\\\\.\\pipe\\dockerDesktopLinuxEngine';
  const pipeOk = pipeExists(pipePath);
  const portOk = checkPostgresPort();
  
  console.log(`   Pipe Docker: ${pipeOk ? '✅' : '❌'}`);
  console.log(`   Porta 5432: ${portOk ? '✅' : '❌'}`);
  console.log('');
  
  if (pipeOk && portOk) {
    console.log('✅ Docker Desktop OK!');
    console.log('');
    return; // Continua o fluxo do npm run dev
  }
  
  // Problema detectado - para tudo e orienta o usuário
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('❌ DOCKER DESKTOP COM PROBLEMA!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('🔧 Para corrigir automaticamente:');
  console.log('   npm run docker:fix');
  console.log('');
  console.log('🔧 Para corrigir manualmente:');
  console.log('   1. Feche o Docker Desktop (botão direito → Quit Docker Desktop)');
  console.log('   2. Aguarde 5 segundos');
  console.log('   3. Abra o Docker Desktop novamente');
  console.log('   4. Aguarde os containers subirem (verde no ícone)');
  console.log('   5. Execute: npm run dev');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  process.exit(1); // Encerra com erro - o && no npm run dev para aqui
}

main();
