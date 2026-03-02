"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Adicionar campo sessionWindowExpiresAt para controle da janela de 24h (API Oficial)
    await queryInterface.addColumn("Tickets", "sessionWindowExpiresAt", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });

    // Adicionar índice para consultas rápidas
    await queryInterface.addIndex("Tickets", ["sessionWindowExpiresAt"], {
      name: "tickets_session_window_expires_idx"
    });

    console.log("[Migration] Coluna sessionWindowExpiresAt adicionada à tabela Tickets");
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("Tickets", "sessionWindowExpiresAt");
    await queryInterface.removeIndex("Tickets", "tickets_session_window_expires_idx");
    console.log("[Migration] Coluna sessionWindowExpiresAt removida da tabela Tickets");
  }
};
