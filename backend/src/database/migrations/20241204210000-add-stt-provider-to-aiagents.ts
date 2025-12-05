import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("AIAgents", "sttProvider", {
      type: DataTypes.ENUM("openai", "gemini", "disabled"),
      allowNull: true,
      defaultValue: "disabled"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("AIAgents", "sttProvider");
  }
};
