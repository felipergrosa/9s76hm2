import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "WhatsappTemplates";

    // Caminho relativo (dentro de public/company{id}/) do arquivo de mídia
    // usado no HEADER do template. Necessário porque a Meta não disponibiliza
    // o arquivo de exemplo de volta — o header_handle é um token opaco do
    // Resumable Upload, não uma URL baixável.
    const tableDefinition: any = await queryInterface.describeTable(table);
    if (!tableDefinition.headerMediaPath) {
      await queryInterface.addColumn(table, "headerMediaPath", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("WhatsappTemplates", "headerMediaPath");
  }
};
