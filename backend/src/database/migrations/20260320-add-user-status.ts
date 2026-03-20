import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.addColumn('Users', 'status', {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
      });
      console.log('✅ Coluna status adicionada à tabela Users');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Coluna status já existe na tabela Users');
      } else {
        throw error;
      }
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn('Users', 'status');
    console.log('❌ Coluna status removida da tabela Users');
  }
};
