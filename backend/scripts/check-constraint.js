const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('whaticket', 'postgres', 'efe487b6a861100fb704ad9f5c160cb8', {
  host: '45.159.230.141',
  dialect: 'postgres'
});

async function checkConstraint() {
  try {
    const [results] = await sequelize.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints 
      WHERE table_name = 'queues' 
        AND constraint_name = 'queues_folderid_fkey'
        AND constraint_type = 'FOREIGN KEY'
    `);

    console.log('Verificando constraint queues_folderid_fkey:');
    if (results.length > 0) {
      console.log('⚠️  Constraint ainda existe:');
      results.forEach(c => console.log('   -', c.constraint_name));
      console.log('\n📝 Isso indica que a migração UP não foi executada em produção!');
    } else {
      console.log('✅ Constraint não encontrada (migration já executada ou nunca existiu)');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkConstraint();
