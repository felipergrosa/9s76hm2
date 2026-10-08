import { QueryInterface, DataTypes } from "sequelize";

// Flag "Tela de fechamento": quando ativa, o fechamento de ticket exige
// assunto do atendimento e permite resumo/observações (alimenta o
// Relatório de Fechamento /closing-report).
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Verifica se a coluna já existe antes de adicionar (idempotente)
    const table = await queryInterface.describeTable("CompaniesSettings");

    if (!table.hasOwnProperty("enableClosingForm")) {
      await queryInterface.addColumn("CompaniesSettings", "enableClosingForm", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("CompaniesSettings", "enableClosingForm");
  }
};
