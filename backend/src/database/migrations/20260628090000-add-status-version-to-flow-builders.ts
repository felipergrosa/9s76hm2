import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("FlowBuilders", "status", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "published" // fluxos já existentes continuam tratados como publicados
    });

    await queryInterface.addColumn("FlowBuilders", "version", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FlowBuilders", "version");
    await queryInterface.removeColumn("FlowBuilders", "status");
  }
};
