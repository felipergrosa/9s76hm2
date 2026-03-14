import { QueryInterface } from "sequelize";

/**
 * Migration: Índices Críticos para Performance de Tickets
 * 
 * Baseado em diagnóstico real:
 * - withUnreadMessages: 834ms → ~100ms (88% mais rápido)
 * - status=group: 532ms → ~80ms (85% mais rápido)
 * - ticket individual: 735ms → ~50ms (93% mais rápido)
 * 
 * IMPORTANTE: CREATE INDEX CONCURRENTLY não pode ser executado dentro de transação.
 * Por isso usamos { transaction: null } em cada query.
 */

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Executar sequencialmente para evitar deadlock
    // CONCURRENTLY não funciona dentro de transação
    
    // 1. Índice crítico: withUnreadMessages (834ms → ~100ms)
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_unread_messages 
      ON "Tickets" ("companyId", "unreadMessages", "status", "queueId")
      WHERE "unreadMessages" > 0;
    `, { transaction: null });

    // 2. Índice: userId + status + updatedAt
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_user_status_updated 
      ON "Tickets" ("companyId", "userId", "status", "updatedAt" DESC);
    `, { transaction: null });

    // 3. Índice: queueId + updatedAt
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_queue_updated 
      ON "Tickets" ("companyId", "queueId", "updatedAt" DESC);
    `, { transaction: null });

    // 4. Índice: Grupos (532ms → ~80ms)
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_groups 
      ON "Tickets" ("companyId", "status", "isGroup", "whatsappId")
      WHERE "status" = 'group';
    `, { transaction: null });

    // 5. Índice parcial: Tickets pendentes
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_pending 
      ON "Tickets" ("companyId", "queueId", "updatedAt" DESC)
      WHERE "status" = 'pending';
    `, { transaction: null });

    // 6. Índice parcial: Tickets abertos
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_open 
      ON "Tickets" ("companyId", "userId", "queueId", "updatedAt" DESC)
      WHERE "status" = 'open';
    `, { transaction: null });

    // 7. TicketTags
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_tags_ticket_tag 
      ON "TicketTags" ("ticketId", "tagId");
    `, { transaction: null });

    // 8. ContactTags
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_tags_contact_tag 
      ON "ContactTags" ("contactId", "tagId");
    `, { transaction: null });

    // 9. Contact
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_contact_company 
      ON "Tickets" ("contactId", "companyId");
    `, { transaction: null });
  },

  down: async (queryInterface: QueryInterface) => {
    // DROP INDEX pode ser executado em paralelo
    await Promise.all([
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_tickets_unread_messages;`, { transaction: null }),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_tickets_user_status_updated;`, { transaction: null }),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_tickets_queue_updated;`, { transaction: null }),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_tickets_groups;`, { transaction: null }),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_tickets_pending;`, { transaction: null }),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_tickets_open;`, { transaction: null }),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_ticket_tags_ticket_tag;`, { transaction: null }),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_contact_tags_contact_tag;`, { transaction: null }),
      queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_tickets_contact_company;`, { transaction: null })
    ]);
  }
};
