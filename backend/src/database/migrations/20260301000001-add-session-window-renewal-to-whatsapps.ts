import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("Whatsapps", "sessionWindowRenewalMessage", {
        type: DataTypes.TEXT,
        allowNull: true
      }),
      queryInterface.addColumn("Whatsapps", "sessionWindowRenewalMinutes", {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 60
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Whatsapps", "sessionWindowRenewalMessage"),
      queryInterface.removeColumn("Whatsapps", "sessionWindowRenewalMinutes")
    ]);
  }
};
