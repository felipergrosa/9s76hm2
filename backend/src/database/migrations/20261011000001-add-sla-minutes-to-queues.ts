import { QueryInterface, DataTypes } from "sequelize";

// SLA de primeira resposta/atualização por fila, em minutos.
// NULL ou 0 = fila sem SLA configurado (Kanban usa o fallback heurístico:
// janela de 24h do WhatsApp + mensagens não lidas paradas há 24h).
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Queues", "slaMinutes", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Queues", "slaMinutes");
  }
};
