import { QueryInterface, Sequelize } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface, _sequelize: typeof Sequelize) => {
    // Atualizar todos os usuários que têm online=null para online=false
    await queryInterface.sequelize.query(`
      UPDATE "Users" 
      SET "online" = false 
      WHERE "online" IS NULL
    `);
    
    console.log("[Migration] Usuários com online=null atualizados para online=false");
  },

  down: async (queryInterface: QueryInterface, _sequelize: typeof Sequelize) => {
    // Não é possível reverter para null de forma segura
  }
};
