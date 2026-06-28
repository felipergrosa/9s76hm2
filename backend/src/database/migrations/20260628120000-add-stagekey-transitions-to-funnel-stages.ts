import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("FunnelStages", "stageKey", {
      type: DataTypes.STRING,
      allowNull: true // identificador estável da etapa, usado como alvo de transitions
    });

    await queryInterface.addColumn("FunnelStages", "transitions", {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [] // regras tipadas de avanço de etapa (item 12 do plano)
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FunnelStages", "transitions");
    await queryInterface.removeColumn("FunnelStages", "stageKey");
  }
};
