import { QueryInterface, DataTypes, Op } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "Whatsapps";

    // Token opaco que identifica a conexão no webchat público (/webchat/:token).
    // É um bearer credential público por natureza (vai na URL do chat), então
    // fica fora do sanitizeWhatsapp e só é exposto via endpoint autenticado
    // POST /whatsapp/:id/webchat-token.
    const tableDefinition: any = await queryInterface.describeTable(table);
    if (!tableDefinition.webchatToken) {
      await queryInterface.addColumn(table, "webchatToken", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }

    // Índice único parcial: só vale para linhas com token preenchido
    // (Postgres permite vários NULLs em unique, mas o índice parcial é explícito).
    const indexes: any = await queryInterface.showIndex(table);
    const hasIndex = indexes.some(
      (idx: any) => idx.name === "whatsapps_webchat_token_unique"
    );
    if (!hasIndex) {
      await queryInterface.addIndex(table, ["webchatToken"], {
        name: "whatsapps_webchat_token_unique",
        unique: true,
        where: { webchatToken: { [Op.ne]: null } }
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "Whatsapps",
      "whatsapps_webchat_token_unique"
    );
    await queryInterface.removeColumn("Whatsapps", "webchatToken");
  }
};
