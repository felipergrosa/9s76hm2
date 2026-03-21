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
  online: DataTypes.BOOLEAN,
  lastActivityAt: DataTypes.DATE,
  status: DataTypes.STRING,
  companyId: DataTypes.INTEGER
}, {
  tableName: 'Users',
  underscored: false,
  timestamps: true
});

async function simulateOfflineUser() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco');
    
    // Colocar usuário felipe (ID 3) como offline há 4h
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    
    const result = await User.update(
      { 
        online: false, 
        lastActivityAt: fourHoursAgo,
        status: null
      },
      { 
        where: { id: 3 },
        returning: true
      }
    );
    
    console.log(`\n🔴 Usuário ID 3 colocado offline (lastActivity: ${fourHoursAgo.toLocaleString()})`);
    console.log('\n📝 Agora navegue pelo sistema e observe os logs do backend...');
    console.log('   O middleware trackUserActivity deve detectar a atividade e colocar online novamente');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await sequelize.close();
  }
}

simulateOfflineUser();
