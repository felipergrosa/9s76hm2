import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("ContactCustomFields", "type", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "text" // text, number, date, boolean, select — registros existentes continuam como texto livre
    });

    await queryInterface.addColumn("ContactCustomFields", "options", {
      type: DataTypes.JSON,
      allowNull: true // só usado quando type = "select"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("ContactCustomFields", "options");
    await queryInterface.removeColumn("ContactCustomFields", "type");
  }
};
