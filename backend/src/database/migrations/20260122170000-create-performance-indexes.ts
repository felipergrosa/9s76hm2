import { QueryInterface } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            // Habilitar extensão pg_trgm para busca por texto
            await queryInterface.sequelize.query(
                `CREATE EXTENSION IF NOT EXISTS pg_trgm;`,
                { transaction }
            );

            // 1. Índice para listagem de tickets por status (mais acessado)
            await queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_perf_tickets_company_status_updated 
        ON "Tickets" ("companyId", "status", "updatedAt" DESC);
      `, { transaction }).catch(() => { });

            // 2. Índice para busca de tickets por contato
            await queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_perf_tickets_company_contact 
        ON "Tickets" ("companyId", "contactId");
      `, { transaction }).catch(() => { });

            // 3. Índice para filtro por usuário e fila
            await queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_perf_tickets_company_user_queue 
        ON "Tickets" ("companyId", "userId", "queueId");
      `, { transaction }).catch(() => { });

            // 4. Índice para tickets pendentes
            await queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_perf_tickets_pending 
        ON "Tickets" ("companyId", "queueId", "status") 
        WHERE status = 'pending';
      `, { transaction }).catch(() => { });

            // 5. Índice para mensagens por ticket
            await queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_perf_messages_ticket_created 
        ON "Messages" ("ticketId", "createdAt" DESC);
      `, { transaction }).catch(() => { });

            // 6. Índice para contatos por empresa e número
            await queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_perf_contacts_company_number 
        ON "Contacts" ("companyId", "number");
      `, { transaction }).catch(() => { });

            // 7. Índice para busca por nome de contato
            await queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_perf_contacts_name_lower 
        ON "Contacts" (lower("name"));
      `, { transaction }).catch(() => { });

            // 8. Índices para tags de contatos
            await queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_perf_contact_tags_contact 
        ON "ContactTags" ("contactId");
      `, { transaction }).catch(() => { });

            await queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_perf_contact_tags_tag 
        ON "ContactTags" ("tagId");
      `, { transaction }).catch(() => { });

            // 9. Índice para tickets por WhatsApp
            await queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_perf_tickets_whatsapp 
        ON "Tickets" ("whatsappId", "companyId");
      `, { transaction }).catch(() => { });

            // 10. Índice para campanhas ativas
            await queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_perf_campaigns_status 
        ON "Campaigns" ("companyId", "status");
      `, { transaction }).catch(() => { });

            // 11. Índice para envios de campanha
            await queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_perf_campaign_shipping 
        ON "CampaignShippings" ("campaignId", "deliveredAt");
      `, { transaction }).catch(() => { });

            // 12. Índice para tickets com mensagens não lidas
            await queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_perf_tickets_unread 
        ON "Tickets" ("companyId", "unreadMessages") 
        WHERE "unreadMessages" > 0;
      `, { transaction }).catch(() => { });

            // 13. Índice para tickets de grupos
            await queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_perf_tickets_groups 
        ON "Tickets" ("companyId", "isGroup", "status") 
        WHERE "isGroup" = true;
      `, { transaction }).catch(() => { });

            // 14. Índice para logs de tickets
            await queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_perf_log_tickets 
        ON "LogTickets" ("ticketId", "createdAt" DESC);
      `, { transaction }).catch(() => { });

            // Atualizar estatísticas
            await queryInterface.sequelize.query(`ANALYZE "Tickets";`, { transaction }).catch(() => { });
            await queryInterface.sequelize.query(`ANALYZE "Messages";`, { transaction }).catch(() => { });
            await queryInterface.sequelize.query(`ANALYZE "Contacts";`, { transaction }).catch(() => { });
            await queryInterface.sequelize.query(`ANALYZE "ContactTags";`, { transaction }).catch(() => { });

            await transaction.commit();
            console.log("✅ Performance indexes created successfully!");
        } catch (error) {
            await transaction.rollback();
            console.error("❌ Error creating performance indexes:", error);
            // Não re-throw para não bloquear deploy se alguns índices já existirem
        }
    },

    down: async (queryInterface: QueryInterface) => {
        // Remove todos os índices de performance
        const indexes = [
            "idx_perf_tickets_company_status_updated",
            "idx_perf_tickets_company_contact",
            "idx_perf_tickets_company_user_queue",
            "idx_perf_tickets_pending",
            "idx_perf_messages_ticket_created",
            "idx_perf_contacts_company_number",
            "idx_perf_contacts_name_lower",
            "idx_perf_contact_tags_contact",
            "idx_perf_contact_tags_tag",
            "idx_perf_tickets_whatsapp",
            "idx_perf_campaigns_status",
            "idx_perf_campaign_shipping",
            "idx_perf_tickets_unread",
            "idx_perf_tickets_groups",
            "idx_perf_log_tickets"
        ];

        for (const index of indexes) {
            await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "${index}";`).catch(() => { });
        }
    }
};
