const { DataTypes } = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes("CustomFieldConfigs")) {
      await queryInterface.createTable("CustomFieldConfigs", {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "Companies", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
        entityType: { type: DataTypes.STRING(50), allowNull: false }, // lead | ticket | company | deal
        key: { type: DataTypes.STRING(100), allowNull: false },
        label: { type: DataTypes.STRING(255), allowNull: false },
        type: { type: DataTypes.STRING(50), defaultValue: "text" }, // text | number | date | boolean | select
        options: { type: DataTypes.JSON, allowNull: true },
        required: { type: DataTypes.BOOLEAN, defaultValue: false },
        position: { type: DataTypes.INTEGER, defaultValue: 0 },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false }
      });
      await queryInterface.addIndex("CustomFieldConfigs", ["companyId", "entityType", "key"], { unique: true, name: "custom_field_configs_unique" });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable("CustomFieldConfigs");
  }
};
