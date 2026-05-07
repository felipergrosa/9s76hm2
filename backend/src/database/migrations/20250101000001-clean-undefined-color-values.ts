import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface) {
    // Limpar valores corrompidos (#undefined ou undefined) na tabela Settings
    await queryInterface.sequelize.query(`
      UPDATE "Settings"
      SET value = ''
      WHERE value = '#undefined' OR value = 'undefined'
    `);
  },

  async down(queryInterface: QueryInterface) {
    // Reverter: não é possível restaurar os valores originais
    // Esta migration é de limpeza, rollback não é necessário
  }
};
