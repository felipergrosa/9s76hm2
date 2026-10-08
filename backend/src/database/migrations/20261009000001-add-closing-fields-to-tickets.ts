import { QueryInterface, DataTypes } from "sequelize";

// Campos de fechamento de chamado (assunto e resumo) preenchidos pela
// tela de fechamento e exibidos no Relatório de Fechamento.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface
      .addColumn("Tickets", "closingSubject", {
        type: DataTypes.STRING,
        allowNull: true
      })
      .then(() => {
        return queryInterface.addColumn("Tickets", "closingSummary", {
          type: DataTypes.TEXT,
          allowNull: true
        });
      })
      .then(() => {
        // Índice para o filtro de assunto do relatório de fechamento
        return queryInterface.addIndex("Tickets", ["closingSubject"], {
          name: "tickets_closing_subject_idx"
        });
      });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface
      .removeIndex("Tickets", "tickets_closing_subject_idx")
      .then(() => {
        return queryInterface.removeColumn("Tickets", "closingSubject");
      })
      .then(() => {
        return queryInterface.removeColumn("Tickets", "closingSummary");
      });
  }
};
