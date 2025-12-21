const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable("CompaniesSettings");
      
      // Adicionar campo para controlar captura automática de contatos de grupos
      if (!table["autoCaptureGroupContacts"]) {
        await queryInterface.addColumn(
          "CompaniesSettings",
          "autoCaptureGroupContacts",
          {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: "disabled", // Desabilitado por padrão para evitar problemas
          },
          { transaction }
        );
      }
    });
  },

  down: async (queryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable("CompaniesSettings");
      
      if (table["autoCaptureGroupContacts"]) {
        await queryInterface.removeColumn(
          "CompaniesSettings",
          "autoCaptureGroupContacts",
          { transaction }
        );
      }
    });
  },
};
