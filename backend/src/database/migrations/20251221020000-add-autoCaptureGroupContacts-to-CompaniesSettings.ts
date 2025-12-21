import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Verifica se a coluna já existe antes de adicionar
    const table = await queryInterface.describeTable("CompaniesSettings");
    
    if (!table.hasOwnProperty("autoCaptureGroupContacts")) {
      await queryInterface.addColumn("CompaniesSettings", "autoCaptureGroupContacts", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "disabled",
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("CompaniesSettings", "autoCaptureGroupContacts");
  }
};
