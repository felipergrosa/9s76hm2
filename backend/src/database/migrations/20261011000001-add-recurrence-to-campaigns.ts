import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "Campaigns";

    // Recorrência do disparo da campanha (estilo Fluxoo):
    // - "recurrence": none | daily | weekly | monthly
    // - "recurrenceEndAt": data limite da repetição (null = sem fim)
    const tableDefinition: any = await queryInterface.describeTable(table);

    if (!tableDefinition.recurrence) {
      await queryInterface.addColumn(table, "recurrence", {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "none"
      });
    }

    if (!tableDefinition.recurrenceEndAt) {
      await queryInterface.addColumn(table, "recurrenceEndAt", {
        type: DataTypes.DATE,
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Campaigns", "recurrenceEndAt");
    await queryInterface.removeColumn("Campaigns", "recurrence");
  }
};
