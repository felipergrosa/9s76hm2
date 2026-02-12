const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('whaticket', 'postgres', 'efe487b6a861100fb704ad9f5c160cb8', {
  host: '45.159.230.141',
  dialect: 'postgres'
});

async function checkMigration() {
  try {
    const [results] = await sequelize.query(`
      SELECT name FROM SequelizeMeta 
      WHERE name LIKE '%remove-fk-folderId-force%' 
      ORDER BY name
    `);
    
    console.log('Status da migração remove-fk-folderId-force:');
    if (results.length > 0) {
      results.forEach(r => console.log('✅', r.name));
    } else {
      console.log('❌ Migração não encontrada no banco');
    }

    // Verificar também se a constraint existe
    const [constraints] = await sequelize.query(`
      SELECT conname as constraint_name
      FROM information_schema.table_constraints 
      WHERE table_name = 'queues' 
        AND constraint_name = 'queues_folderid_fkey'
        AND constraint_type = 'FOREIGN KEY'
    `);

    if (constraints.length > 0) {
      console.log('\n⚠️  Constraint ainda existe no banco:');
      constraints.forEach(c => console.log('   -', c.constraint_name));
      console.log('\n📝 Isso indica que a migração UP não foi executada em produção!');
    } else {
      console.log('\n✅ Constraint não encontrada (migration já executada ou nunca existiu)');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkMigration();
