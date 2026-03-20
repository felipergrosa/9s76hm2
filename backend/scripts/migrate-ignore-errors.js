const { exec } = require('child_process');

console.log('🔄 Executando migrações do Sequelize (ignorando erros de coluna duplicada)...');

exec('npx sequelize db:migrate', (error, stdout, stderr) => {
  if (error) {
    // Verificar se é erro de coluna duplicada (que pode ser ignorado)
    if (stderr.includes('already exists') || stderr.includes('duplicate column')) {
      console.log('⚠️  Algumas colunas já existem (normal em desenvolvimento)');
      console.log('✅ Migrações concluídas com avisos');
    } else {
      console.error('❌ Erro nas migrações:');
      console.error(stderr);
      process.exit(1);
    }
  } else {
    console.log('✅ Migrações executadas com sucesso');
  }
  
  if (stdout) {
    console.log(stdout);
  }
});
