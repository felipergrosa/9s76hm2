"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === "postgres") {
      // ALTER COLUMN type to TEXT first, then re-add check constraint if desired
      await queryInterface.sequelize.query(
        `ALTER TABLE "LeadScraperJobs" ALTER COLUMN "source" TYPE VARCHAR(32) USING "source"::text;`
      );
    } else {
      await queryInterface.changeColumn("LeadScraperJobs", "source", {
        type: Sequelize.STRING(32),
        allowNull: false,
      });
    }
  },
  down: async () => {},
};
