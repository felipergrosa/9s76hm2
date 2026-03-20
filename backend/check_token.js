const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('whaticket', 'postgres', 'efe487b6a861100fb704ad9f5c160cb8', {
  host: 'localhost',
  dialect: 'postgres',
  port: 5432
});

async function checkToken() {
  try {
    await sequelize.authenticate();
    console.log('Conectado ao banco com sucesso!');
    
    const results = await sequelize.query(
      'SELECT id, name, token, status FROM "Whatsapps" WHERE token = :token',
      {
        replacements: { token: 'qsFj2s8e2XY850HcNMAvEw' },
        type: Sequelize.QueryTypes.SELECT
      }
    );
    
    console.log('Resultado da consulta:', results);
    
    if (!results || results.length === 0) {
      console.log('❌ Token não encontrado no banco!');
      
      // Listar todos os tokens disponíveis
      const allTokens = await sequelize.query(
        'SELECT id, name, token, status FROM "Whatsapps" ORDER BY id',
        { type: Sequelize.QueryTypes.SELECT }
      );
      
      console.log('\nTokens disponíveis:');
      if (allTokens && allTokens.length > 0) {
        allTokens.forEach(w => {
          console.log(`ID: ${w.id} | Nome: ${w.name} | Token: ${w.token} | Status: ${w.status}`);
        });
      } else {
        console.log('Nenhuma conexão WhatsApp encontrada no banco.');
      }
    } else {
      console.log('✅ Token encontrado!');
      results.forEach(w => {
        console.log(`ID: ${w.id} | Nome: ${w.name} | Status: ${w.status}`);
      });
    }
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

checkToken();
