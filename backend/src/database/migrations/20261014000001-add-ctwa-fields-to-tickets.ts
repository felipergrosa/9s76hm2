import { QueryInterface, DataTypes } from "sequelize";

// Campos de atribuição de anúncios Click-to-WhatsApp (CTWA).
// Quando a primeira mensagem de um ticket chega via anúncio da Meta,
// o webhook traz message.referral com source_type="ad": persistimos
// ctwa_clid (clique), source_id (id do anúncio) e headline para
// alimentar o Relatório de Anúncios (/ads-report).
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface
      .addColumn("Tickets", "ctwaClid", {
        type: DataTypes.STRING,
        allowNull: true
      })
      .then(() => {
        return queryInterface.addColumn("Tickets", "adId", {
          type: DataTypes.STRING,
          allowNull: true
        });
      })
      .then(() => {
        return queryInterface.addColumn("Tickets", "adHeadline", {
          type: DataTypes.STRING,
          allowNull: true
        });
      })
      .then(() => {
        // Índice para o filtro "leads que vieram de anúncio" do relatório
        return queryInterface.addIndex("Tickets", ["ctwaClid"], {
          name: "tickets_ctwa_clid_idx"
        });
      });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface
      .removeIndex("Tickets", "tickets_ctwa_clid_idx")
      .then(() => {
        return queryInterface.removeColumn("Tickets", "ctwaClid");
      })
      .then(() => {
        return queryInterface.removeColumn("Tickets", "adId");
      })
      .then(() => {
        return queryInterface.removeColumn("Tickets", "adHeadline");
      });
  }
};
