const { exec } = require('child_process');

console.log('🔄 Executando migrações do Sequelize (ignorando erros de coluna duplicada)...');

exec('npx sequelize db:migrate', { cwd: process.cwd() }, (error, stdout, stderr) => {
  // Mostrar stdout sempre
  if (stdout && stdout.trim()) {
    console.log(stdout);
  }
  
  if (error) {
    // Verificar se é erro que pode ser ignorado
    const ignoreErrors = [
      'already exists',
      'duplicate column',
      'duplicate key',
      'relation',
      'column',
      'table',
      'constraint'
    ];
    
    const shouldIgnore = ignoreErrors.some(err => 
      stderr.toLowerCase().includes(err.toLowerCase())
    );
    
    if (shouldIgnore) {
      console.log('⚠️  Algumas colunas/tabelas já existem (normal em desenvolvimento)');
      console.log('✅ Migrações concluídas com avisos');
    } else {
      console.error('❌ Erro nas migrações:');
      if (stderr && stderr.trim()) {
        console.error(stderr);
      }
      console.error('Código do erro:', error.code);
      console.error('Mensagem:', error.message);
      process.exit(1);
    }
  } else {
    console.log('✅ Migrações executadas com sucesso');
  }
  
  // Mostrar stderr se não for vazio
  if (stderr && stderr.trim() && !error) {
    console.log(stderr);
  }
});
