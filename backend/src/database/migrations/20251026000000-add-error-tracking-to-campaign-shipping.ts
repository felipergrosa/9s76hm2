import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable("CampaignShipping");

      // Adiciona campo para rastrear tentativas de envio
      if (!table["attempts"]) {
        await queryInterface.addColumn(
          "CampaignShipping",
          "attempts",
          {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
          },
          { transaction }
        );
      }

      // Adiciona campo para última mensagem de erro
      if (!table["lastError"]) {
        await queryInterface.addColumn(
          "CampaignShipping",
          "lastError",
          {
            type: DataTypes.TEXT,
            allowNull: true,
          },
          { transaction }
        );
      }

      // Adiciona campo para data do último erro
      if (!table["lastErrorAt"]) {
        await queryInterface.addColumn(
          "CampaignShipping",
          "lastErrorAt",
          {
            type: DataTypes.DATE,
            allowNull: true,
          },
          { transaction }
        );
      }

      // Adiciona campo para status detalhado
      if (!table["status"]) {
        await queryInterface.addColumn(
          "CampaignShipping",
          "status",
          {
            type: DataTypes.STRING,
            defaultValue: "pending", // pending, processing, delivered, failed, suppressed
            allowNull: false,
          },
          { transaction }
        );
      }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable("CampaignShipping");

      if (table["attempts"]) {
        await queryInterface.removeColumn("CampaignShipping", "attempts", { transaction });
      }

      if (table["lastError"]) {
        await queryInterface.removeColumn("CampaignShipping", "lastError", { transaction });
      }

      if (table["lastErrorAt"]) {
        await queryInterface.removeColumn("CampaignShipping", "lastErrorAt", { transaction });
      }

      if (table["status"]) {
        await queryInterface.removeColumn("CampaignShipping", "status", { transaction });
      }
    });
  },
};
