import { QueryInterface, DataTypes } from "sequelize";

// Campos de atribuição de anúncios Click-to-WhatsApp (CTWA).
// Quando a primeira mensagem de um ticket chega via anúncio da Meta,
// o webhook traz message.referral com source_type="ad": persistimos
// ctwa_clid (clique), source_id (id do anúncio) e headline para
// alimentar o Relatório de Anúncios (/ads-report).
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

    if (!tableInfo.ctwaClid) {
      await queryInterface.addColumn(table, "ctwaClid", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }

    if (!tableInfo.adId) {
      await queryInterface.addColumn(table, "adId", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }

    if (!tableInfo.adHeadline) {
      await queryInterface.addColumn(table, "adHeadline", {
        type: DataTypes.STRING,
        allowNull: true
      });
    }

    // Índice para o filtro "leads que vieram de anúncio" do relatório
    const indexes = (await queryInterface.showIndex(table)) as Array<{
      name?: string;
    }>;
    if (!indexes.some((idx) => idx.name === "tickets_ctwa_clid_idx")) {
      await queryInterface.addIndex(table, ["ctwaClid"], {
        name: "tickets_ctwa_clid_idx"
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const table = "Tickets";

    try {
      await queryInterface.removeIndex(table, "tickets_ctwa_clid_idx");
    } catch (e) {
      // índice pode não existir se o up rodou parcialmente
    }

    const tableInfo = (await queryInterface.describeTable(table)) as Record<
      string,
      any
    >;
    if (tableInfo.ctwaClid) {
      await queryInterface.removeColumn(table, "ctwaClid");
    }
    if (tableInfo.adId) {
      await queryInterface.removeColumn(table, "adId");
    }
    if (tableInfo.adHeadline) {
      await queryInterface.removeColumn(table, "adHeadline");
    }
  }
};
