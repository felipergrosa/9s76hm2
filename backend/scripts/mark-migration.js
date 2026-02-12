const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('whaticket', 'postgres', 'efe487b6a861100fb704ad9f5c160cb8', {
  host: '45.159.230.141',
  dialect: 'postgres'
});

async function markMigration() {
  try {
    await sequelize.query(`
      INSERT INTO "SequelizeMeta" (name) 
      VALUES ('20251127165501-remove-fk-folderId-force.js') 
      ON CONFLICT (name) DO NOTHING
    `);
    console.log('✅ Migration marcada como executada');
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await sequelize.close();
  }
}

markMigration();
