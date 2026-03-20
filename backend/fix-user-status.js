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

async function fixUserStatus() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco');
    
    // Atualizar usuário felipe (ID 3) para online
    const result = await User.update(
      { 
        online: true, 
        lastActivityAt: new Date(),
        status: null
      },
      { 
        where: { id: 3 },
        returning: true
      }
    );
    
    console.log(`\n✅ Usuário ID 3 atualizado: ${result[0]} linha(s) afetadas`);
    
    // Verificar status após atualização
    const user = await User.findByPk(3, {
      attributes: ['id', 'name', 'email', 'online', 'lastActivityAt', 'status']
    });
    
    console.log('\n📊 Status Atualizado:');
    console.log('ID | Nome | Email | Online | Last Activity | Status');
    console.log('---|------|-------|--------|---------------|--------');
    console.log(`${user.id} | ${user.name} | ${user.email} | ${user.online} | ${user.lastActivityAt.toLocaleString()} | ${user.status || 'null'} 🟢`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await sequelize.close();
  }
}

fixUserStatus();
