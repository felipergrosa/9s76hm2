import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("CompaniesSettings", "externalFormWebhookToken", {
      type: DataTypes.TEXT,
      allowNull: true // sem valor = endpoint de webhook externo desabilitado para a empresa
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("CompaniesSettings", "externalFormWebhookToken");
  }
};
