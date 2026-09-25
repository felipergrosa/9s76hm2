"use strict";

// Postgres nao remove valor de ENUM — down() intencionalmente vazio.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_LeadScraperJobs_status" ADD VALUE IF NOT EXISTS 'cancelled';`
    );
  },
  down: async () => {}
};
