import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table: any = await queryInterface.describeTable("Campaigns");

    // Tag de controle da campanha: marca contatos ao disparar e é removida
    // quando o contato responde (ou quando a campanha finaliza)
    if (!table["campaignTagId"]) {
      await queryInterface.addColumn("Campaigns", "campaignTagId", {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Tags", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const table: any = await queryInterface.describeTable("Campaigns");
    if (table["campaignTagId"]) {
      await queryInterface.removeColumn("Campaigns", "campaignTagId");
    }
  }
};
