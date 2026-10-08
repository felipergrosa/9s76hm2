import { QueryInterface, DataTypes } from "sequelize";

// Automação Meta (referência Fluxoo/ManyChat) — ações de engajamento:
// - autoLikeComment: curtir o comentário que disparou a regra
// - requireFollower / nonFollowerAction / nonFollowerText: check de seguidor
//   com ação alternativa quando o remetente não segue a conta
// - rewardMediaUrl / rewardMediaType: "recompensa" — mídia/anexo na DM
//   (na private reply de comentário vai como link no texto, pois a Meta só
//   permite UMA mensagem de texto por comentário)
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      // Idempotente: só cria colunas que ainda não existem
      const table = await queryInterface.describeTable("MetaAutomationRules");

      if (!table["autoLikeComment"]) {
        await queryInterface.addColumn(
          "MetaAutomationRules",
          "autoLikeComment",
          {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
          },
          { transaction }
        );
      }

      if (!table["requireFollower"]) {
        await queryInterface.addColumn(
          "MetaAutomationRules",
          "requireFollower",
          {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
          },
          { transaction }
        );
      }

      // "skip" = pular DM/fluxo para não-seguidor | "ask_follow" = enviar
      // nonFollowerText pedindo o follow e não enviar a DM principal
      if (!table["nonFollowerAction"]) {
        await queryInterface.addColumn(
          "MetaAutomationRules",
          "nonFollowerAction",
          {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "skip"
          },
          { transaction }
        );
      }

      if (!table["nonFollowerText"]) {
        await queryInterface.addColumn(
          "MetaAutomationRules",
          "nonFollowerText",
          { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
          { transaction }
        );
      }

      if (!table["rewardMediaUrl"]) {
        await queryInterface.addColumn(
          "MetaAutomationRules",
          "rewardMediaUrl",
          { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
          { transaction }
        );
      }

      // image | video | audio | file — tipos de attachment do Send API Meta
      if (!table["rewardMediaType"]) {
        await queryInterface.addColumn(
          "MetaAutomationRules",
          "rewardMediaType",
          { type: DataTypes.STRING, allowNull: true, defaultValue: null },
          { transaction }
        );
      }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable("MetaAutomationRules");

      const columns = [
        "autoLikeComment",
        "requireFollower",
        "nonFollowerAction",
        "nonFollowerText",
        "rewardMediaUrl",
        "rewardMediaType"
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
