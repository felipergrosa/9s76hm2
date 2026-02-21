/**
 * Script para verificar e corrigir pipes do Docker Desktop no Windows
 * 
 * PROBLEMA: Docker Desktop com WSL2 às vezes perde os pipes de comunicação
 * com o Windows, causando:
 * - Docker CLI não conecta (npipe:////./pipe/dockerDesktopLinuxEngine)
 * - Port forwarding não funciona (localhost:5432, localhost:6379 não respondem)
 * - Backend não consegue conectar ao banco
 * 
 * CAUSA RAIZ: O Docker Desktop usa pipes nomeados do Windows para comunicação
 * entre o host Windows e o WSL2. Esses pipes podem ser perdidos quando:
 * - Windows hiberna/suspende
 * - Docker Desktop é atualizado
 * - WSL2 é reiniciado
 * - Antivírus interfere nos pipes
 * - Corrupção de memória do processo Docker Desktop
 * 
 * SOLUÇÃO: Verificar se os pipes existem e reiniciar Docker Desktop se necessário
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Pipes críticos do Docker Desktop
const REQUIRED_PIPES = [
  '\\\\.\\pipe\\dockerDesktopLinuxEngine',
  '\\\\.\\pipe\\docker_engine'
];

// Verifica se um pipe existe
function pipeExists(pipePath) {
  try {
    fs.accessSync(pipePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// Verifica se todos os pipes necessários existem
function checkPipes() {
  console.log('🔍 Verificando pipes do Docker Desktop...');
  
  for (const pipe of REQUIRED_PIPES) {
    const exists = pipeExists(pipe);
    console.log(`  ${exists ? '✅' : '❌'} ${pipe}`);
    if (!exists) {
      return false;
    }
  }
  
  return true;
}

// Verifica se o Docker CLI consegue conectar
function checkDockerConnection() {
  try {
    console.log('🔍 Verificando conexão com Docker CLI...');
    const result = execSync('docker ps --format "{{.Names}}" 2>&1', { 
      encoding: 'utf8',
      timeout: 10000 
    });
    
    if (result.includes('failed to connect') || result.includes('error')) {
      console.log('  ❌ Docker CLI não consegue conectar');
      return false;
    }
    
    console.log('  ✅ Docker CLI conectado');
    return true;
  } catch (error) {
    console.log('  ❌ Erro ao verificar Docker CLI:', error.message);
    return false;
  }
}

// Verifica se as portas estão acessíveis
function checkPorts() {
  try {
    console.log('🔍 Verificando portas do Docker...');
    
    const ports = [5432, 6379, 8080];
    let allAccessible = true;
    
    for (const port of ports) {
      try {
        const result = execSync(
          `powershell -Command "(Test-NetConnection -ComputerName localhost -Port ${port} -InformationLevel Quiet).ToString()"`,
          { encoding: 'utf8', timeout: 15000 }
        );
        
        const accessible = result.trim().toLowerCase() === 'true';
        console.log(`  ${accessible ? '✅' : '❌'} Porta ${port}`);
        
        if (!accessible) {
          allAccessible = false;
        }
      } catch {
        console.log(`  ❌ Porta ${port} (erro ao verificar)`);
        allAccessible = false;
      }
    }
    
    return allAccessible;
  } catch (error) {
    console.log('  ❌ Erro ao verificar portas:', error.message);
    return false;
  }
}

// Reinicia o Docker Desktop
function restartDockerDesktop() {
  console.log('🔄 Reiniciando Docker Desktop...');
  
  try {
    // Mata todos os processos do Docker Desktop
    execSync('powershell -Command "Stop-Process -Name \\"Docker Desktop\\" -Force -ErrorAction SilentlyContinue"', {
      timeout: 10000
    });
    
    console.log('  ⏳ Aguardando Docker Desktop fechar...');
    
    // Aguarda processos fecharem
    let attempts = 0;
    while (attempts < 10) {
      try {
        const result = execSync('powershell -Command "Get-Process -Name \\"Docker Desktop\\" -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count"', {
          encoding: 'utf8',
          timeout: 5000
        });
        
        if (parseInt(result.trim()) === 0) {
          break;
        }
      } catch {
        break;
      }
      
      attempts++;
      execSync('timeout /t 1 /nobreak > nul', { shell: true });
    }
    
    // Inicia o Docker Desktop
    console.log('  🚀 Iniciando Docker Desktop...');
    
    const dockerPath = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';
    
    if (!fs.existsSync(dockerPath)) {
      console.log('  ❌ Docker Desktop não encontrado em:', dockerPath);
      return false;
    }
    
    spawn(dockerPath, [], {
      detached: true,
      stdio: 'ignore'
    }).unref();
    
    // Aguarda Docker Desktop inicializar
    console.log('  ⏳ Aguardando Docker Desktop inicializar...');
    
    let retries = 0;
    const maxRetries = 30; // 30 segundos
    
    while (retries < maxRetries) {
      execSync('timeout /t 1 /nobreak > nul', { shell: true });
      retries++;
      
      // Verifica se os pipes foram criados
      if (pipeExists(REQUIRED_PIPES[0])) {
        console.log(`  ✅ Pipes criados após ${retries} segundos`);
        
        // Aguarda mais um pouco para estabilizar
        execSync('timeout /t 5 /nobreak > nul', { shell: true });
        
        return true;
      }
      
      if (retries % 5 === 0) {
        console.log(`  ⏳ Ainda aguardando... (${retries}s)`);
      }
    }
    
    console.log('  ❌ Timeout aguardando pipes serem criados');
    return false;
    
  } catch (error) {
    console.log('  ❌ Erro ao reiniciar Docker Desktop:', error.message);
    return false;
  }
}

// Função principal
async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  VERIFICAÇÃO DO DOCKER DESKTOP');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  // Verifica se está no Windows
  if (process.platform !== 'win32') {
    console.log('⚠️ Este script é apenas para Windows');
    process.exit(0);
  }
  
  const args = process.argv.slice(2);
  const autoFix = args.includes('--auto-fix') || args.includes('-f');
  const checkOnly = args.includes('--check') || args.includes('-c');
  
  // Verifica estado atual
  const pipesOk = checkPipes();
  const dockerOk = checkDockerConnection();
  const portsOk = checkPorts();
  
  console.log('');
  console.log('📊 RESUMO:');
  console.log(`  Pipes: ${pipesOk ? '✅ OK' : '❌ FALHOU'}`);
  console.log(`  Docker CLI: ${dockerOk ? '✅ OK' : '❌ FALHOU'}`);
  console.log(`  Portas: ${portsOk ? '✅ OK' : '❌ FALHOU'}`);
  console.log('');
  
  if (pipesOk && dockerOk && portsOk) {
    console.log('✅ Docker Desktop funcionando corretamente!');
    process.exit(0);
  }
  
  if (checkOnly) {
    console.log('❌ Problemas detectados. Execute sem --check para corrigir automaticamente.');
    process.exit(1);
  }
  
  if (!autoFix) {
    console.log('❌ Problemas detectados no Docker Desktop!');
    console.log('');
    console.log('🔧 Para corrigir automaticamente, execute:');
    console.log('   node scripts/check-docker-pipes.js --auto-fix');
    console.log('');
    console.log('Ou reinicie manualmente o Docker Desktop.');
    process.exit(1);
  }
  
  // Correção automática
  console.log('🔧 Iniciando correção automática...');
  console.log('');
  
  const restarted = restartDockerDesktop();
  
  if (restarted) {
    // Verifica novamente após correção
    console.log('');
    console.log('🔍 Verificando após correção...');
    
    const pipesOkAfter = checkPipes();
    const dockerOkAfter = checkDockerConnection();
    const portsOkAfter = checkPorts();
    
    console.log('');
    console.log('📊 RESULTADO APÓS CORREÇÃO:');
    console.log(`  Pipes: ${pipesOkAfter ? '✅ OK' : '❌ FALHOU'}`);
    console.log(`  Docker CLI: ${dockerOkAfter ? '✅ OK' : '❌ FALHOU'}`);
    console.log(`  Portas: ${portsOkAfter ? '✅ OK' : '❌ FALHOU'}`);
    console.log('');
    
    if (pipesOkAfter && dockerOkAfter && portsOkAfter) {
      console.log('✅ Docker Desktop corrigido com sucesso!');
      process.exit(0);
    } else {
      console.log('⚠️ Correção parcial. Pode ser necessário reiniciar novamente.');
      process.exit(1);
    }
  } else {
    console.log('❌ Falha ao reiniciar Docker Desktop');
    console.log('');
    console.log('🔧 Tente reiniciar manualmente:');
    console.log('   1. Feche o Docker Desktop');
    console.log('   2. Aguarde 10 segundos');
    console.log('   3. Abra o Docker Desktop novamente');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
