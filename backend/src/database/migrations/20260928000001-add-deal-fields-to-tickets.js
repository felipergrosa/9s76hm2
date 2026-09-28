const { DataTypes } = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    const table = await queryInterface.describeTable("Tickets");

    if (!table.isDeal) {
      await queryInterface.addColumn("Tickets", "isDeal", {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      });
    }

    if (!table.value) {
      await queryInterface.addColumn("Tickets", "value", {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
        allowNull: true
      });
    }

    if (!table.dealTitle) {
      await queryInterface.addColumn("Tickets", "dealTitle", {
        type: DataTypes.STRING(255),
        allowNull: true
      });
    }

    if (!table.dealDescription) {
      await queryInterface.addColumn("Tickets", "dealDescription", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }
  },
  down: async (queryInterface) => {
    const table = await queryInterface.describeTable("Tickets");

    if (table.dealDescription) {
      await queryInterface.removeColumn("Tickets", "dealDescription");
    }
    if (table.dealTitle) {
      await queryInterface.removeColumn("Tickets", "dealTitle");
    }
    if (table.value) {
      await queryInterface.removeColumn("Tickets", "value");
    }
    if (table.isDeal) {
      await queryInterface.removeColumn("Tickets", "isDeal");
    }
  }
};
