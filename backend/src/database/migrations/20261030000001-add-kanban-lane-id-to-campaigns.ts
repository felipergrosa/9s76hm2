import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table: any = await queryInterface.describeTable("Campaigns");

    // Lane do Kanban: tag kanban aplicada ao TICKET da campanha no disparo.
    // Diferente de campaignTagId (marca o contato), esta posiciona o lead
    // em uma fase do funil assim que o ticket é criado.
    if (!table["kanbanLaneId"]) {
      await queryInterface.addColumn("Campaigns", "kanbanLaneId", {
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
    if (table["kanbanLaneId"]) {
      await queryInterface.removeColumn("Campaigns", "kanbanLaneId");
    }
  }
};
