import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Índice composto para otimizar queries de listagem de mensagens
    // Query principal: WHERE ticketId IN (...) AND companyId = ? ORDER BY createdAt DESC
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_ticket_company_created
      ON "Messages" ("ticketId", "companyId", "createdAt" DESC);
    `).catch(async () => {
      // Fallback sem CONCURRENTLY para bancos que não suportam
      await queryInterface.addIndex("Messages", ["ticketId", "companyId", "createdAt"], {
        name: "idx_messages_ticket_company_created"
      });
    });

    // Índice para busca por wid (usado em deduplicação)
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_wid_company
      ON "Messages" ("wid", "companyId");
    `).catch(async () => {
      await queryInterface.addIndex("Messages", ["wid", "companyId"], {
        name: "idx_messages_wid_company"
      });
    });

    // Índice para queries de mensagens recentes (usado no polling)
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_created_company
      ON "Messages" ("createdAt" DESC, "companyId");
    `).catch(async () => {
      await queryInterface.addIndex("Messages", ["createdAt", "companyId"], {
        name: "idx_messages_created_company"
      });
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("Messages", "idx_messages_ticket_company_created").catch(() => {});
    await queryInterface.removeIndex("Messages", "idx_messages_wid_company").catch(() => {});
    await queryInterface.removeIndex("Messages", "idx_messages_created_company").catch(() => {});
  }
};
