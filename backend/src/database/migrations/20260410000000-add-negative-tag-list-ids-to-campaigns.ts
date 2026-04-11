import { QueryInterface, DataTypes } from "sequelize";

export default {
  up: async (queryInterface: QueryInterface) => {
    const tableDesc = await queryInterface.describeTable("Campaigns");
    if (!tableDesc["negativeTagListIds"]) {
      await queryInterface.addColumn("Campaigns", "negativeTagListIds", {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const tableDesc = await queryInterface.describeTable("Campaigns");
    if (tableDesc["negativeTagListIds"]) {
      await queryInterface.removeColumn("Campaigns", "negativeTagListIds");
    }
  }
};
