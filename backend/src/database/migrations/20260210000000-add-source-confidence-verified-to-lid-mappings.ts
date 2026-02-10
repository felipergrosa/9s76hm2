"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable("LidMappings");

    // Coluna source: origem do mapeamento (ex: baileys_lid_mapping_event, baileys_signal_repository)
    if (!tableDesc.source) {
      await queryInterface.addColumn("LidMappings", "source", {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
        comment: "Origem do mapeamento (ex: baileys_lid_mapping_event, baileys_signal_repository, recent_ticket_match)"
      });
    }

    // Coluna confidence: nível de confiança do mapeamento (0.0 a 1.0)
    if (!tableDesc.confidence) {
      await queryInterface.addColumn("LidMappings", "confidence", {
        type: Sequelize.FLOAT,
        allowNull: true,
        defaultValue: null,
        comment: "Nível de confiança do mapeamento (0.0 a 1.0)"
      });
    }

    // Coluna verified: se o mapeamento foi verificado pelo Baileys
    if (!tableDesc.verified) {
      await queryInterface.addColumn("LidMappings", "verified", {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        comment: "Se o mapeamento foi verificado pelo evento lid-mapping.update do Baileys"
      });
    }
  },

  down: async (queryInterface) => {
    const tableDesc = await queryInterface.describeTable("LidMappings");

    if (tableDesc.verified) {
      await queryInterface.removeColumn("LidMappings", "verified");
    }
    if (tableDesc.confidence) {
      await queryInterface.removeColumn("LidMappings", "confidence");
    }
    if (tableDesc.source) {
      await queryInterface.removeColumn("LidMappings", "source");
    }
  }
};
