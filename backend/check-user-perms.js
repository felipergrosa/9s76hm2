const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  logging: false
});

async function checkUser() {
  try {
    const [results] = await sequelize.query(
      `SELECT id, name, profile, permissions FROM "Users" WHERE id = 3`
    );
    console.log('User:', results[0]?.name);
    console.log('Profile:', results[0]?.profile);
    console.log('Total permissions:', results[0]?.permissions?.length);
    console.log('Permissions:', JSON.stringify(results[0]?.permissions, null, 2));
    
    // Verificar se tem as permissões necessárias
    const required = ['settings.view', 'connections.view', 'announcements.view', 'users.view'];
    required.forEach(p => {
      const has = results[0]?.permissions?.includes(p);
      console.log(`  ${p}: ${has ? '✅' : '❌'}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
}

checkUser();
