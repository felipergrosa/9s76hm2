const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '../.env');

const environments = {
  dev: {
    file: '.env.local',
    description: '🔧 Desenvolvimento (banco local Docker)'
  },
  prod: {
    file: '.env.production',
    description: '🚀 Produção (banco remoto - CUIDADO!)'
  }
};

function switchEnvironment(targetEnv) {
  const env = environments[targetEnv];
  
  if (!env) {
    console.error('❌ Ambiente inválido. Use: dev ou prod');
    process.exit(1);
  }

  const sourceFile = path.join(__dirname, '..', env.file);
  
  if (!fs.existsSync(sourceFile)) {
    console.error(`❌ Arquivo ${env.file} não encontrado`);
    process.exit(1);
  }

  try {
    // Backup do .env atual
    if (fs.existsSync(ENV_FILE)) {
      fs.copyFileSync(ENV_FILE, `${ENV_FILE}.backup`);
      console.log('💾 Backup do .env atual salvo');
    }

    // Copiar o ambiente desejado
    fs.copyFileSync(sourceFile, ENV_FILE);
    
    console.log(`\n✅ Ambiente alterado para: ${env.description}`);
    console.log(`📁 Arquivo usado: ${env.file}`);
    
    // Mostrar configuração atual
    const envContent = fs.readFileSync(ENV_FILE, 'utf8');
    const dbHost = envContent.match(/DB_HOST=(.+)/)?.[1] || 'N/A';
    const dbName = envContent.match(/DB_NAME=(.+)/)?.[1] || 'N/A';
    const nodeEnv = envContent.match(/NODE_ENV=(.+)/)?.[1] || 'N/A';
    
    console.log('\n📋 Configuração atual:');
    console.log(`   - NODE_ENV: ${nodeEnv}`);
    console.log(`   - DB_HOST: ${dbHost}`);
    console.log(`   - DB_NAME: ${dbName}`);
    
    if (targetEnv === 'prod') {
      console.log('\n⚠️  ATENÇÃO: Você está usando dados de PRODUÇÃO!');
      console.log('   - Tenha cuidado com alterações');
      console.log('   - Não execute testes destrutivos');
    }
    
  } catch (error) {
    console.error('❌ Erro ao alterar ambiente:', error.message);
    process.exit(1);
  }
}

// Verificar argumento
const targetEnv = process.argv[2];

if (!targetEnv) {
  console.log('🔄 Alternador de Ambiente - Whaticket');
  console.log('\nUso:');
  console.log('  node switch-env.js dev   - Para desenvolvimento (banco local)');
  console.log('  node switch-env.js prod  - Para produção (CUIDADO!)');
  console.log('\nAmbientes disponíveis:');
  Object.entries(environments).forEach(([key, env]) => {
    console.log(`  ${key}: ${env.description}`);
  });
  process.exit(0);
}

switchEnvironment(targetEnv);
