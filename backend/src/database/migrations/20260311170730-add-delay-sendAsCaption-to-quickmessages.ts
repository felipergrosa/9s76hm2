import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (t) => {
      const tableDesc = await queryInterface.describeTable("QuickMessages") as any;

      if (!tableDesc.delay) {
        await queryInterface.addColumn(
          "QuickMessages",
          "delay",
          {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
          },
          { transaction: t }
        );
      }

      if (!tableDesc.sendAsCaption) {
        await queryInterface.addColumn(
          "QuickMessages",
          "sendAsCaption",
          {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
          },
          { transaction: t }
        );
      }

      // Alterar mediaPath e mediaName para TEXT para suportar JSON de múltiplos arquivos
      await queryInterface.changeColumn(
        "QuickMessages",
        "mediaPath",
        {
          type: DataTypes.TEXT,
          allowNull: true,
          defaultValue: null
        },
        { transaction: t }
      );

      await queryInterface.changeColumn(
        "QuickMessages",
        "mediaName",
        {
          type: DataTypes.TEXT,
          allowNull: true,
          defaultValue: null
        },
        { transaction: t }
      );
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.removeColumn("QuickMessages", "delay", { transaction: t });
      await queryInterface.removeColumn("QuickMessages", "sendAsCaption", { transaction: t });
      
      // Reverter para STRING (opcional, mas boa prática)
      await queryInterface.changeColumn(
        "QuickMessages",
        "mediaPath",
        {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null
        },
        { transaction: t }
      );

      await queryInterface.changeColumn(
        "QuickMessages",
        "mediaName",
        {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null
        },
        { transaction: t }
      );
    });
  }
};
