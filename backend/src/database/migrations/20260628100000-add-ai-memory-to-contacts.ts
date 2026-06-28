import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Contacts", "aiMemory", {
      type: DataTypes.TEXT,
      allowNull: true // item 10 do plano: resumo mantido pela IA entre tickets do mesmo contato
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Contacts", "aiMemory");
  }
};
