module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Índice para otimizar a BUSCA 7 no resolveContact
    // Busca tickets por companyId + isGroup + status + updatedAt
    await queryInterface.addIndex("Tickets", ["companyId", "isGroup", "status", "updatedAt"], {
      name: "idx_tickets_busca7",
      indicesType: 'BTREE'
    }).catch(() => { /* já existe */ });

    // Índice adicional para busca por lidJid (BUSCA 2)
    await queryInterface.addIndex("Contacts", ["companyId", "lidJid"], {
      name: "idx_contacts_lidjid",
      indicesType: 'BTREE'
    }).catch(() => { /* já existe */ });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex("Tickets", "idx_tickets_busca7").catch(() => {});
    await queryInterface.removeIndex("Contacts", "idx_contacts_lidjid").catch(() => {});
  }
};
