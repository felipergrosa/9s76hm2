import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    try {
      // Check if pgvector extension is available
      const [results] = await queryInterface.sequelize.query(`
        SELECT name FROM pg_available_extensions WHERE name = 'vector'
      `);

      if (results && results.length > 0) {
        await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "vector"');
        console.log('pgvector extension created successfully');
      } else {
        console.warn('pgvector extension is not available. RAG functionality will be limited. Install pgvector extension for full functionality.');
      }
    } catch (error) {
      console.warn('Failed to create pgvector extension:', error.message);
      console.warn('RAG functionality will be limited. Install pgvector extension for full functionality.');
    }
  },

  down: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS "vector"');
    } catch (error) {
      console.warn('Failed to drop pgvector extension:', error.message);
    }
  }
};
