import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("AIAgents", "startDelayEnabled", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn("AIAgents", "startDelaySeconds", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 15
    });

    await queryInterface.addColumn("AIAgents", "startDelayJitterSeconds", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 5
    });

    await queryInterface.addColumn("AIAgents", "antiBotTraitsRegex", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn("AIAgents", "maxBotLoopMessages", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 4
    });

    await queryInterface.addColumn("AIAgents", "requireHistoryForAI", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("AIAgents", "requireHistoryForAI");
    await queryInterface.removeColumn("AIAgents", "maxBotLoopMessages");
    await queryInterface.removeColumn("AIAgents", "antiBotTraitsRegex");
    await queryInterface.removeColumn("AIAgents", "startDelayJitterSeconds");
    await queryInterface.removeColumn("AIAgents", "startDelaySeconds");
    await queryInterface.removeColumn("AIAgents", "startDelayEnabled");
  }
};
