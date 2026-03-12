import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (t) => {
      const tableDesc = await queryInterface.describeTable("QuickMessages") as any;

      if (!tableDesc.flow) {
        await queryInterface.addColumn(
          "QuickMessages",
          "flow",
          {
            type: DataTypes.TEXT, // Usando TEXT para compatibilidade com SQLite/MySQL/Postgres via JSON.parse
            allowNull: true,
            defaultValue: null
          },
          { transaction: t }
        );
      }
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.removeColumn("QuickMessages", "flow", { transaction: t });
    });
  }
};
