import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "DripSequenceSteps";
    const def: any = await queryInterface.describeTable(table);

    if (!def.delayMinutes) {
      await queryInterface.addColumn(table, "delayMinutes", {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      });
    }

    // Template Meta opcional — necessário para conexões oficiais fora da janela de 24h
    if (!def.metaTemplateName) {
      await queryInterface.addColumn(table, "metaTemplateName", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }

    if (!def.metaTemplateLanguage) {
      await queryInterface.addColumn(table, "metaTemplateLanguage", {
        type: DataTypes.STRING(10),
        allowNull: true
      });
    }

    // JSON com o mapeamento de variáveis do template (mesmo formato das campanhas)
    if (!def.metaTemplateVariables) {
      await queryInterface.addColumn(table, "metaTemplateVariables", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("DripSequenceSteps", "delayMinutes");
    await queryInterface.removeColumn("DripSequenceSteps", "metaTemplateName");
    await queryInterface.removeColumn("DripSequenceSteps", "metaTemplateLanguage");
    await queryInterface.removeColumn("DripSequenceSteps", "metaTemplateVariables");
  }
};
