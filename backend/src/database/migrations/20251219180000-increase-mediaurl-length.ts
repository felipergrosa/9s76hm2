import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Aumentar tamanho do campo mediaUrl de VARCHAR(255) para TEXT
    // Necessário para URLs longas da API oficial do WhatsApp
    await queryInterface.changeColumn("Messages", "mediaUrl", {
      type: DataTypes.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    // Reverter para VARCHAR(255) se necessário
    await queryInterface.changeColumn("Messages", "mediaUrl", {
      type: DataTypes.STRING(255),
      allowNull: true
    });
  }
};
