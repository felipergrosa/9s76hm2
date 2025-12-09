import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableInfo = await queryInterface.describeTable("Campaigns") as Record<string, any>;
    
    // Adicionar coluna userIds se não existir
    if (!tableInfo.userIds) {
      await queryInterface.addColumn("Campaigns", "userIds", {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "JSON array de IDs de usuários para distribuição por tags"
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Campaigns", "userIds");
  }
};
