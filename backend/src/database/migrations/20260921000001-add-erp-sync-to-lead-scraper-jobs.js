const { DataTypes } = require("sequelize");

// Status de exportação do job de leads para o ERP (via n8n/webhook)
module.exports = {
  up: async (queryInterface) => {
    const table = await queryInterface.describeTable("LeadScraperJobs");
    if (!table.erpSyncStatus) {
      await queryInterface.addColumn("LeadScraperJobs", "erpSyncStatus", {
        type: DataTypes.STRING(20),
        allowNull: true // null = nunca exportado | pending | sent | failed
      });
    }
    if (!table.erpSyncedAt) {
      await queryInterface.addColumn("LeadScraperJobs", "erpSyncedAt", {
        type: DataTypes.DATE,
        allowNull: true
      });
    }
    if (!table.erpSyncError) {
      await queryInterface.addColumn("LeadScraperJobs", "erpSyncError", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn("LeadScraperJobs", "erpSyncStatus");
    await queryInterface.removeColumn("LeadScraperJobs", "erpSyncedAt");
    await queryInterface.removeColumn("LeadScraperJobs", "erpSyncError");
  }
};
