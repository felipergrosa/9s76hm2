import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("Chats", "type", {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "group"
      }),
      queryInterface.addColumn("Chats", "directKey", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Chats", "directKey"),
      queryInterface.removeColumn("Chats", "type")
    ]);
  }
};
