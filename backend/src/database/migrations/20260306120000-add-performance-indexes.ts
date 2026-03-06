import { QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      // Índice para listagem de mensagens por ticket (mais usado)
      queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_ticket_created 
        ON "Messages" ("ticketId", "createdAt" DESC);
      `),

      // Índice para busca de tickets por status e atualização
      queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_status_updated 
        ON "Tickets" ("status", "updatedAt" DESC);
      `),

      // Índice para busca de tickets por company e status
      queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_company_status 
        ON "Tickets" ("companyId", "status", "updatedAt" DESC);
      `),

      // Índice para busca de contatos por número
      queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_number 
        ON "Contacts" ("number");
      `),

      // Índice para busca de contatos por company
      queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_company 
        ON "Contacts" ("companyId", "createdAt" DESC);
      `),

      // Índice para mensagens não lidas
      queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_ack 
        ON "Messages" ("ticketId", "ack") WHERE "fromMe" = false;
      `),

      // Índice para tickets por usuário
      queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_user 
        ON "Tickets" ("userId", "status", "updatedAt" DESC);
      `),

      // Índice para tickets por queue
      queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_queue 
        ON "Tickets" ("queueId", "status", "updatedAt" DESC);
      `),

      // Índice para WhatsApp sessions
      queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapps_company_status 
        ON "Whatsapps" ("companyId", "status");
      `),

      // Índice para mensagens por remoteJid (grupos)
      queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_remotejid 
        ON "Messages" ("ticketId", "remoteJid", "createdAt" DESC);
      `),

      // Índice para busca de contatos duplicados (canonicalNumber)
      queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_canonical 
        ON "Contacts" ("companyId", "canonicalNumber") WHERE "canonicalNumber" IS NOT NULL;
      `)
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_messages_ticket_created;`),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_tickets_status_updated;`),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_tickets_company_status;`),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_contacts_number;`),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_contacts_company;`),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_messages_ack;`),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_tickets_user;`),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_tickets_queue;`),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_whatsapps_company_status;`),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_messages_remotejid;`),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_contacts_canonical;`)
    ]);
  }
};
