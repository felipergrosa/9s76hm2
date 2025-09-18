import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("CompaniesSettings", "ragEnabled", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "disabled",
    });
    await queryInterface.addColumn("CompaniesSettings", "ragTopK", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 4,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("CompaniesSettings", "ragEnabled");
    await queryInterface.removeColumn("CompaniesSettings", "ragTopK");
  }
};
