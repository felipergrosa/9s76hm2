const { DataTypes } = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes("LeadScraperJobs")) {
      await queryInterface.createTable("LeadScraperJobs", {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        companyId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "Companies", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
        source: { type: DataTypes.ENUM("google_maps", "cnpj"), allowNull: false },
        status: { type: DataTypes.ENUM("pending", "running", "done", "error"), defaultValue: "pending" },
        filters: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
        results: { type: DataTypes.JSON, defaultValue: [] },
        progress: { type: DataTypes.INTEGER, defaultValue: 0 },
        totalFound: { type: DataTypes.INTEGER, defaultValue: 0 },
        errorMessage: { type: DataTypes.TEXT, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false }
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable("LeadScraperJobs");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_LeadScraperJobs_source"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_LeadScraperJobs_status"');
  }
};
