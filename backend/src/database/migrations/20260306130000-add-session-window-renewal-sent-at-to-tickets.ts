import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Tickets", "sessionWindowRenewalSentAt", {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      comment: "Data/hora do último envio da mensagem de renovação de janela 24h"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Tickets", "sessionWindowRenewalSentAt");
  }
};
