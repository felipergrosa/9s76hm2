import { QueryInterface, DataTypes } from "sequelize";

// Campos de fechamento de chamado (assunto e resumo) preenchidos pela
// tela de fechamento e exibidos no Relatório de Fechamento.
//
// Idempotente: checa coluna/índice antes de criar. Se um boot anterior
// morreu no meio (ex.: lock no Postgres), o retry completa o que falta
// em vez de falhar em "column already exists" e travar as migrations
// seguintes — o auto-migrate sobe o server mesmo com migrate falho.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "Tickets";
    const tableInfo = (await queryInterface.describeTable(table)) as Record<
      string,
      any
    >;

    if (!tableInfo.closingSubject) {
      await queryInterface.addColumn(table, "closingSubject", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }

    if (!tableInfo.closingSummary) {
      await queryInterface.addColumn(table, "closingSummary", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }

    // Índice para o filtro de assunto do relatório de fechamento
    const indexes = (await queryInterface.showIndex(table)) as Array<{
      name?: string;
    }>;
    if (!indexes.some((idx) => idx.name === "tickets_closing_subject_idx")) {
      await queryInterface.addIndex(table, ["closingSubject"], {
        name: "tickets_closing_subject_idx"
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const table = "Tickets";

    try {
      await queryInterface.removeIndex(table, "tickets_closing_subject_idx");
    } catch (e) {
      // índice pode não existir se o up rodou parcialmente
    }

    const tableInfo = (await queryInterface.describeTable(table)) as Record<
      string,
      any
    >;
    if (tableInfo.closingSubject) {
      await queryInterface.removeColumn(table, "closingSubject");
    }
    if (tableInfo.closingSummary) {
      await queryInterface.removeColumn(table, "closingSummary");
    }
  }
};
