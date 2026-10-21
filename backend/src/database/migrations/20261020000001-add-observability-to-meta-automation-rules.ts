import { QueryInterface, DataTypes } from "sequelize";

// Automação Meta — observabilidade do disparo + ação de moderação:
// - hideComment: ocultar o comentário na thread pública após responder
// - lastError / lastErrorAt / failureCount: telemetria de falhas do job
//   (mensagem sanitizada, sem tokens nem dados de contato)
// - lastTriggeredAt: carimbo do último disparo (já existia na criação da
//   tabela — incluído aqui por idempotência para bases antigas)
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      // Idempotente: só cria colunas que ainda não existem
      const table = await queryInterface.describeTable("MetaAutomationRules");

      if (!table["hideComment"]) {
        await queryInterface.addColumn(
          "MetaAutomationRules",
          "hideComment",
          {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
          },
          { transaction }
        );
      }

      if (!table["lastError"]) {
        await queryInterface.addColumn(
          "MetaAutomationRules",
          "lastError",
          { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
          { transaction }
        );
      }

      if (!table["lastErrorAt"]) {
        await queryInterface.addColumn(
          "MetaAutomationRules",
          "lastErrorAt",
          { type: DataTypes.DATE, allowNull: true, defaultValue: null },
          { transaction }
        );
      }

      if (!table["failureCount"]) {
        await queryInterface.addColumn(
          "MetaAutomationRules",
          "failureCount",
          {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
          },
          { transaction }
        );
      }

      if (!table["lastTriggeredAt"]) {
        await queryInterface.addColumn(
          "MetaAutomationRules",
          "lastTriggeredAt",
          { type: DataTypes.DATE, allowNull: true, defaultValue: null },
          { transaction }
        );
      }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable("MetaAutomationRules");

      const columns = [
        "hideComment",
        "lastError",
        "lastErrorAt",
        "failureCount",
        "lastTriggeredAt"
      ];

      for (const column of columns) {
        if (table[column]) {
          await queryInterface.removeColumn("MetaAutomationRules", column, {
            transaction
          });
        }
      }
    });
  }
};
