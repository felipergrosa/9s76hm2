import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Campaigns", "metaTemplateName", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn("Campaigns", "metaTemplateLanguage", {
      type: DataTypes.STRING(20),
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Campaigns", "metaTemplateLanguage");
    await queryInterface.removeColumn("Campaigns", "metaTemplateName");
  }
};
