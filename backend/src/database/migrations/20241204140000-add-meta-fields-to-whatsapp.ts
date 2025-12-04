import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (t) => {
      const tableInfo = await queryInterface.describeTable("Whatsapps") as Record<string, unknown>;

      // Adicionar campo metaAppId se não existir
      if (!tableInfo.metaAppId) {
        await queryInterface.addColumn(
          "Whatsapps",
          "metaAppId",
          {
            type: DataTypes.TEXT,
            allowNull: true
          },
          { transaction: t }
        );
      }

      // Adicionar campo metaAppSecret se não existir
      if (!tableInfo.metaAppSecret) {
        await queryInterface.addColumn(
          "Whatsapps",
          "metaAppSecret",
          {
            type: DataTypes.TEXT,
            allowNull: true
          },
          { transaction: t }
        );
      }

      // Adicionar campo metaAccessToken se não existir
      if (!tableInfo.metaAccessToken) {
        await queryInterface.addColumn(
          "Whatsapps",
          "metaAccessToken",
          {
            type: DataTypes.TEXT,
            allowNull: true
          },
          { transaction: t }
        );
      }

      // Adicionar campo metaPageId se não existir
      if (!tableInfo.metaPageId) {
        await queryInterface.addColumn(
          "Whatsapps",
          "metaPageId",
          {
            type: DataTypes.TEXT,
            allowNull: true
          },
          { transaction: t }
        );
      }

      // Adicionar campo metaPageAccessToken se não existir
      if (!tableInfo.metaPageAccessToken) {
        await queryInterface.addColumn(
          "Whatsapps",
          "metaPageAccessToken",
          {
            type: DataTypes.TEXT,
            allowNull: true
          },
          { transaction: t }
        );
      }

      // Adicionar campo metaWebhookVerifyToken se não existir
      if (!tableInfo.metaWebhookVerifyToken) {
        await queryInterface.addColumn(
          "Whatsapps",
          "metaWebhookVerifyToken",
          {
            type: DataTypes.TEXT,
            allowNull: true
          },
          { transaction: t }
        );
      }

      // Adicionar campo instagramAccountId se não existir
      if (!tableInfo.instagramAccountId) {
        await queryInterface.addColumn(
          "Whatsapps",
          "instagramAccountId",
          {
            type: DataTypes.TEXT,
            allowNull: true
          },
          { transaction: t }
        );
      }
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.removeColumn("Whatsapps", "metaAppId", { transaction: t });
      await queryInterface.removeColumn("Whatsapps", "metaAppSecret", { transaction: t });
      await queryInterface.removeColumn("Whatsapps", "metaAccessToken", { transaction: t });
      await queryInterface.removeColumn("Whatsapps", "metaPageId", { transaction: t });
      await queryInterface.removeColumn("Whatsapps", "metaPageAccessToken", { transaction: t });
      await queryInterface.removeColumn("Whatsapps", "metaWebhookVerifyToken", { transaction: t });
      await queryInterface.removeColumn("Whatsapps", "instagramAccountId", { transaction: t });
    });
  }
};
