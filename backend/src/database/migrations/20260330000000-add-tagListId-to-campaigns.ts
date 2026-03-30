import { QueryInterface, DataTypes } from "sequelize";

export default {
  up: async (queryInterface: QueryInterface) => {
    // Verificar se a coluna já existe
    const tableDesc = await queryInterface.describeTable("Campaigns");
    if (!tableDesc["tagListId"]) {
      await queryInterface.addColumn("Campaigns", "tagListId", {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const tableDesc = await queryInterface.describeTable("Campaigns");
    if (tableDesc["tagListId"]) {
      await queryInterface.removeColumn("Campaigns", "tagListId");
    }
  }
};
