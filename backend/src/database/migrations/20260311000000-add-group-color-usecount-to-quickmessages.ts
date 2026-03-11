import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (t) => {
      // Verificar e adicionar groupName
      const tableDesc = await queryInterface.describeTable("QuickMessages") as any;
      
      if (!tableDesc.groupName) {
        await queryInterface.addColumn(
          "QuickMessages",
          "groupName",
          {
            type: DataTypes.STRING(100),
            allowNull: true,
            defaultValue: null
          },
          { transaction: t }
        );
      }

      if (!tableDesc.color) {
        await queryInterface.addColumn(
          "QuickMessages",
          "color",
          {
            type: DataTypes.STRING(7),
            allowNull: true,
            defaultValue: "#6B7280"
          },
          { transaction: t }
        );
      }

      if (!tableDesc.useCount) {
        await queryInterface.addColumn(
          "QuickMessages",
          "useCount",
          {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
          },
          { transaction: t }
        );
      }
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.removeColumn("QuickMessages", "groupName", { transaction: t });
      await queryInterface.removeColumn("QuickMessages", "color", { transaction: t });
      await queryInterface.removeColumn("QuickMessages", "useCount", { transaction: t });
    });
  }
};
