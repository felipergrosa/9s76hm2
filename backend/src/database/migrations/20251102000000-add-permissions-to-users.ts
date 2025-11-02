import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Users", "permissions", {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      allowNull: false,
      comment: "Array de permissões granulares do usuário (ex: campaigns.view, users.create)"
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Users", "permissions");
  }
};
