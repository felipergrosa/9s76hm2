import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "CampaignShipping";
    const tableDefinition: any = await queryInterface.describeTable(table);

    // wid da mensagem na Meta — permite reconciliar os webhooks de status
    // (sent/delivered/read/failed) com o registro de disparo da campanha
    if (!tableDefinition.wid) {
      await queryInterface.addColumn(table, "wid", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }

    // Último status reportado pela Meta via webhook:
    // sent | delivered | read | failed
    if (!tableDefinition.metaStatus) {
      await queryInterface.addColumn(table, "metaStatus", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }

    // Momento em que a Meta confirmou leitura
    if (!tableDefinition.readAt) {
      await queryInterface.addColumn(table, "readAt", {
        type: DataTypes.DATE,
        allowNull: true
      });
    }

    await queryInterface.addIndex(table, ["wid"], {
      name: "campaign_shipping_wid_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("CampaignShipping", "campaign_shipping_wid_idx");
    await queryInterface.removeColumn("CampaignShipping", "wid");
    await queryInterface.removeColumn("CampaignShipping", "metaStatus");
    await queryInterface.removeColumn("CampaignShipping", "readAt");
  }
};
