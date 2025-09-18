import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("CompaniesSettings", "ragEmbeddingModel", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "text-embedding-3-small"
    });
    await queryInterface.addColumn("CompaniesSettings", "ragEmbeddingDims", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1536
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("CompaniesSettings", "ragEmbeddingModel");
    await queryInterface.removeColumn("CompaniesSettings", "ragEmbeddingDims");
  }
};
