const { Sequelize, DataTypes } = require('sequelize');

// Configuração do banco
const sequelize = new Sequelize(
  'whaticket',
  'postgres',
  'efe487b6a861100fb704ad9f5c160cb8',
  {
    host: 'localhost',
    port: 5432,
    dialect: 'postgres',
    logging: false
  }
);

// Modelo User simplificado
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  online: DataTypes.BOOLEAN,
  lastActivityAt: DataTypes.DATE,
  status: DataTypes.STRING,
  companyId: DataTypes.INTEGER
}, {
  tableName: 'Users',
  underscored: false,
  timestamps: true
});

async function checkUserStatus() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco');
    
    // Buscar todos os usuários
    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'online', 'lastActivityAt', 'status', 'companyId'],
      order: [['id', 'ASC']]
    });
    
    console.log('\n📊 Status dos Usuários:');
    console.log('ID | Nome | Email | Online | Last Activity | Status');
    console.log('---|------|-------|--------|---------------|--------');
    
    const now = new Date();
    
    users.forEach(user => {
      const lastActivity = user.lastActivityAt;
      const diffMinutes = lastActivity ? Math.floor((now - lastActivity) / 60000) : 'N/A';
      
      let statusIcon = '❓';
      if (user.online === true) {
        if (!lastActivity || diffMinutes > 180) {
          statusIcon = '🔴'; // Offline mas marcado como online
        } else if (diffMinutes > 120) {
          statusIcon = '🟡'; // Ausente
        } else {
          statusIcon = '🟢'; // Online
        }
      } else {
        statusIcon = '🔴'; // Offline
      }
      
      console.log(`${user.id} | ${user.name} | ${user.email} | ${user.online} | ${lastActivity ? lastActivity.toLocaleString() : 'N/A'} | ${user.status || 'null'} ${statusIcon}`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkUserStatus();
