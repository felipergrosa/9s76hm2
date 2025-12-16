import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Users", "supervisorViewMode", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "include"
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Users", "supervisorViewMode");
  }
};
