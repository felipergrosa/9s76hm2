import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = await queryInterface.describeTable("Campaigns") as any;
    
    if (!table.sendMediaSeparately) {
      await queryInterface.addColumn("Campaigns", "sendMediaSeparately", {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const table = await queryInterface.describeTable("Campaigns") as any;
    
    if (table.sendMediaSeparately) {
      await queryInterface.removeColumn("Campaigns", "sendMediaSeparately");
    }
  }
};
