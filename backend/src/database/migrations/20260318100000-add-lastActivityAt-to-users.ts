import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Verifica se a coluna já existe antes de adicionar
    const tableDescription = await queryInterface.describeTable("Users") as Record<string, any>;
    
    if (!tableDescription.lastActivityAt) {
      await queryInterface.addColumn("Users", "lastActivityAt", {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null
      });
      console.log("[Migration] Coluna lastActivityAt adicionada à tabela Users");
    } else {
      console.log("[Migration] Coluna lastActivityAt já existe na tabela Users");
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const tableDescription = await queryInterface.describeTable("Users") as Record<string, any>;
    
    if (tableDescription.lastActivityAt) {
      await queryInterface.removeColumn("Users", "lastActivityAt");
      console.log("[Migration] Coluna lastActivityAt removida da tabela Users");
    }
  }
};
