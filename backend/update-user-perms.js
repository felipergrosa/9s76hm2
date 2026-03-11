const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  logging: false
});

async function updateUser() {
  try {
    // Buscar permissões atuais
    const [results] = await sequelize.query(
      `SELECT id, name, permissions FROM "Users" WHERE id = 3`
    );
    
    const currentPerms = results[0]?.permissions || [];
    console.log('Permissões atuais:', currentPerms.length);
    
    // Adicionar permissões faltantes
    const newPerms = [
      'announcements.view',
      'settings.view', 
      'connections.view',
      'users.view'
    ];
    
    const updatedPerms = [...new Set([...currentPerms, ...newPerms])];
    
    // Atualizar no banco
    await sequelize.query(
      `UPDATE "Users" SET permissions = :perms WHERE id = 3`,
      {
        replacements: { perms: JSON.stringify(updatedPerms) }
      }
    );
    
    console.log('Permissões adicionadas:', newPerms.filter(p => !currentPerms.includes(p)));
    console.log('Total permissões agora:', updatedPerms.length);
    
    process.exit(0);
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
}

updateUser();
