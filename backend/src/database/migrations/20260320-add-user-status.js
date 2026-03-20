module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.addColumn('Users', 'status', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
      });
      console.log('✅ Coluna status adicionada à tabela Users');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Coluna status já existe na tabela Users');
      } else {
        throw error;
      }
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Users', 'status');
    console.log('❌ Coluna status removida da tabela Users');
  }
};
