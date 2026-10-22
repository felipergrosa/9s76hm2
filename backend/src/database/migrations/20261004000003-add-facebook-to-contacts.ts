import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableInfo = (await queryInterface.describeTable("Contacts")) as Record<
      string,
      any
    >;

    if (!tableInfo.facebook) {
      await queryInterface.addColumn("Contacts", "facebook", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const tableInfo = (await queryInterface.describeTable("Contacts")) as Record<
      string,
      any
    >;

    if (tableInfo.facebook) {
      await queryInterface.removeColumn("Contacts", "facebook");
    }
  }
};
