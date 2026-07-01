const { DataTypes } = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    const tables = await queryInterface.showAllTables();

    if (!tables.includes("DealStages")) {
      await queryInterface.createTable("DealStages", {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "Companies", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
        name: { type: DataTypes.STRING(255), allowNull: false },
        color: { type: DataTypes.STRING(20), defaultValue: "#5C5C5C" },
        position: { type: DataTypes.INTEGER, defaultValue: 0 },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false }
      });
    }

    if (!tables.includes("Deals")) {
      await queryInterface.createTable("Deals", {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "Companies", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
        stageId: { type: DataTypes.INTEGER, references: { model: "DealStages", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
        contactId: { type: DataTypes.INTEGER, references: { model: "Contacts", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
        userId: { type: DataTypes.INTEGER, references: { model: "Users", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
        title: { type: DataTypes.STRING(255), allowNull: false },
        value: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
        description: { type: DataTypes.TEXT, allowNull: true },
        status: { type: DataTypes.STRING(50), defaultValue: "open" }, // open | won | lost
        closedAt: { type: DataTypes.DATE, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false }
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable("Deals");
    await queryInterface.dropTable("DealStages");
  }
};
