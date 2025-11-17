import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("Whatsapps", "channelType", {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "baileys"
      }),
      queryInterface.addColumn("Whatsapps", "wabaPhoneNumberId", {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
      }),
      queryInterface.addColumn("Whatsapps", "wabaAccessToken", {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
      }),
      queryInterface.addColumn("Whatsapps", "wabaBusinessAccountId", {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
      }),
      queryInterface.addColumn("Whatsapps", "wabaWebhookVerifyToken", {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
      }),
      queryInterface.addColumn("Whatsapps", "wabaConfig", {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Whatsapps", "channelType"),
      queryInterface.removeColumn("Whatsapps", "wabaPhoneNumberId"),
      queryInterface.removeColumn("Whatsapps", "wabaAccessToken"),
      queryInterface.removeColumn("Whatsapps", "wabaBusinessAccountId"),
      queryInterface.removeColumn("Whatsapps", "wabaWebhookVerifyToken"),
      queryInterface.removeColumn("Whatsapps", "wabaConfig")
    ]);
  }
};
