import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn("Contacts", "facebook", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
      }, { transaction });
    });
  },

  down: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn("Contacts", "facebook", { transaction });
    });
  }
};
