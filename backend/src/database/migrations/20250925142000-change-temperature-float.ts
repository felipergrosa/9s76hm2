import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Alterar coluna temperature para FLOAT preservando valores
    await queryInterface.sequelize.query(
      'ALTER TABLE "Prompts" ALTER COLUMN "temperature" TYPE DOUBLE PRECISION USING "temperature"::double precision;'
    );
    // Ajustar default
    await queryInterface.changeColumn("Prompts", "temperature", {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.9,
    });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.changeColumn("Prompts", "temperature", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });
  },
};
