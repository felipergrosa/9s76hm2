"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Índices para acelerar consultas de tickets
    await queryInterface.addIndex(
      "Tickets",
      ["companyId", "status"],
      {
        name: "idx_tickets_company_status",
        unique: false
      }
    );

    await queryInterface.addIndex(
      "Tickets",
      ["contactId", "companyId"],
      {
        name: "idx_tickets_contact_company",
        unique: false
      }
    );

    await queryInterface.addIndex(
      "Tickets",
      ["whatsappId", "status"],
      {
        name: "idx_tickets_whatsapp_status",
        unique: false
      }
    );

    // 2. Índices para logs (se existir tabela)
    try {
      const [tableInfo] = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'TicketLogs'
        );
      `);

      if (tableInfo[0].exists) {
        await queryInterface.addIndex(
          "TicketLogs",
          ["ticketId", "companyId"],
          {
            name: "idx_ticket_logs_ticket_company",
            unique: false
          }
        );
      }
    } catch (error) {
      console.log("Tabela TicketLogs não encontrada, ignorando índice");
    }

    // 3. Índices para tracking
    try {
      const [tableInfo] = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'TicketTrackings'
        );
      `);

      if (tableInfo[0].exists) {
        await queryInterface.addIndex(
          "TicketTrackings",
          ["ticketId"],
          {
            name: "idx_ticket_trackings_ticket",
            unique: false
          }
        );
      }
    } catch (error) {
      console.log("Tabela TicketTrackings não encontrada, ignorando índice");
    }

    // 4. Limpar logs antigos (manter apenas 30 dias)
    try {
      const [tableInfo] = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'TicketLogs'
        );
      `);

      if (tableInfo[0].exists) {
        await queryInterface.sequelize.query(`
          DELETE FROM "TicketLogs" 
          WHERE "createdAt" < NOW() - INTERVAL '30 days'
        `);
        console.log("Logs antigos limpos com sucesso");
      }
    } catch (error) {
      console.log("Erro ao limpar logs antigos:", error.message);
    }

    console.log("✅ Migration de performance de tickets executada com sucesso");
  },

  down: async (queryInterface, Sequelize) => {
    // Remover índices criados (rollback)
    await queryInterface.removeIndex("Tickets", "idx_tickets_company_status");
    await queryInterface.removeIndex("Tickets", "idx_tickets_contact_company");
    await queryInterface.removeIndex("Tickets", "idx_tickets_whatsapp_status");

    try {
      await queryInterface.removeIndex("TicketLogs", "idx_ticket_logs_ticket_company");
    } catch (error) {
      console.log("Índice de TicketLogs não encontrado para remover");
    }

    try {
      await queryInterface.removeIndex("TicketTrackings", "idx_ticket_trackings_ticket");
    } catch (error) {
      console.log("Índice de TicketTrackings não encontrado para remover");
    }

    console.log("✅ Rollback de performance de tickets executado com sucesso");
  }
};
