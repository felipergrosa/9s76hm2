'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Converter coluna queueIds de json para jsonb
    return queryInterface.sequelize.query(`
      ALTER TABLE "AIAgents" 
      ALTER COLUMN "queueIds" TYPE jsonb USING "queueIds"::jsonb;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Reverter para json se necessário
    return queryInterface.sequelize.query(`
      ALTER TABLE "AIAgents" 
      ALTER COLUMN "queueIds" TYPE json USING "queueIds"::json;
    `);
  }
};
