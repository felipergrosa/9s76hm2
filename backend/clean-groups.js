const { Sequelize, QueryTypes } = require('sequelize');
const sequelize = new Sequelize('whaticket', 'postgres', 'efe487b6a861100fb704ad9f5c160cb8', { host: 'localhost', dialect: 'postgres', logging: false });

async function run() {
  try {
    const [results, metadata] = await sequelize.query(`
      UPDATE "Contacts" 
      SET "isGroup" = false 
      WHERE "isGroup" = true 
      AND "number" NOT LIKE '%@g.us' 
      AND "number" NOT LIKE '%-%'
    `);
    
    console.log('Update concluído.');
    console.log('Linhas Afetadas:', metadata.rowCount);
  } catch(e) {
    console.error('Erro na execução:', e);
  } finally {
    await sequelize.close();
  }
}

run();
