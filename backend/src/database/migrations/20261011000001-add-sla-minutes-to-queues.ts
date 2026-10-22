import { QueryInterface, DataTypes } from "sequelize";

// SLA de primeira resposta/atualização por fila, em minutos.
// NULL ou 0 = fila sem SLA configurado (Kanban usa o fallback heurístico:
// janela de 24h do WhatsApp + mensagens não lidas paradas há 24h).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableInfo = (await queryInterface.describeTable("Queues")) as Record<
      string,
      any
    >;

    if (!tableInfo.slaMinutes) {
      await queryInterface.addColumn("Queues", "slaMinutes", {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const tableInfo = (await queryInterface.describeTable("Queues")) as Record<
      string,
      any
    >;

    if (tableInfo.slaMinutes) {
      await queryInterface.removeColumn("Queues", "slaMinutes");
    }
  }
};
