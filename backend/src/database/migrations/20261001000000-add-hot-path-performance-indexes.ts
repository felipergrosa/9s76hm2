import { QueryInterface } from "sequelize";

/**
 * Migration: Índices de performance para queries quentes
 *
 * Cobre lookups por mensagem, dedup de listagem de tickets, relatórios,
 * scans de cron (schedules, tickets por whatsapp), unread de mensagens,
 * TicketTraking e chat interno.
 *
 * IMPORTANTE: CREATE INDEX CONCURRENTLY não pode ser executado dentro de
 * transação — por isso usamos { transaction: null } em cada query.
 * Cada índice é criado isoladamente com try/catch para que uma falha
 * (tabela/coluna inexistente) não aborte os demais.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const sequelize = queryInterface.sequelize;

    const statements: { name: string; sql: string }[] = [
      // 1. Lookup quente de ticket por mensagem recebida
      {
        name: "idx_tickets_contact_company_whatsapp",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_contact_company_whatsapp
              ON "Tickets" ("contactId", "companyId", "whatsappId", "isGroup")`
      },
      // 2. Cobre WHERE + GROUP BY da subquery de dedup na listagem
      {
        name: "idx_tickets_dedup_group",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_dedup_group
              ON "Tickets" ("companyId", "isGroup", "status", "contactId", "whatsappId")`
      },
      // 3. Ordenação de relatórios por data de criação
      {
        name: "idx_tickets_company_created",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_company_created
              ON "Tickets" ("companyId", "createdAt" DESC)`
      },
      // 4. Scans de cron por empresa/whatsapp/status
      {
        name: "idx_tickets_company_whatsapp_status_updated",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_company_whatsapp_status_updated
              ON "Tickets" ("companyId", "whatsappId", "status", "updatedAt")`
      },
      // 5. Índice parcial: mensagens não lidas recebidas
      {
        name: "idx_messages_unread",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_unread
              ON "Messages" ("ticketId", "createdAt" DESC)
              WHERE "read" = false AND "fromMe" = false`
      },
      // 6a. TicketTraking por empresa/ticket (ordenação por id desc)
      {
        name: "idx_tickettraking_company_ticket_id",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickettraking_company_ticket_id
              ON "TicketTraking" ("companyId", "ticketId", "id" DESC)`
      },
      // 6b. Índice parcial: trakings ainda abertos
      {
        name: "idx_tickettraking_open",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickettraking_open
              ON "TicketTraking" ("ticketId")
              WHERE "finishedAt" IS NULL`
      },
      // 7. Índice parcial: schedules pendentes de envio
      {
        name: "idx_schedules_pending_sendat",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_pending_sendat
              ON "Schedules" ("sendAt")
              WHERE "sentAt" IS NULL AND "status" = 'PENDENTE'`
      },
      // 8a. Lookup de canal Meta/Facebook
      {
        name: "idx_whatsapps_fbpage_channel",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapps_fbpage_channel
              ON "Whatsapps" ("facebookPageUserId", "channel")`
      },
      // 8b. Índice parcial: verify token de webhook Meta
      {
        name: "idx_whatsapps_meta_verify_token",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapps_meta_verify_token
              ON "Whatsapps" ("metaWebhookVerifyToken")
              WHERE "metaWebhookVerifyToken" IS NOT NULL`
      },
      // 9a. Mensagens do chat interno por chat
      {
        name: "idx_chatmessages_chat_created",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chatmessages_chat_created
              ON "ChatMessages" ("chatId", "createdAt")`
      },
      // 9b. Chats por usuário
      {
        name: "idx_chatusers_user",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chatusers_user
              ON "ChatUsers" ("userId")`
      },
      // 9c. Par chat+usuário (dedup/membership)
      {
        name: "idx_chatusers_chat_user",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chatusers_chat_user
              ON "ChatUsers" ("chatId", "userId")`
      }
    ];

    // Executar sequencialmente para evitar deadlock
    for (const stmt of statements) {
      try {
        await sequelize.query(stmt.sql, { transaction: null });
        console.log(`[Migration] ✅ Índice ${stmt.name} criado`);
      } catch (err: any) {
        console.log(
          `[Migration] ⚠️  Erro ao criar índice ${stmt.name} (ignorando):`,
          err.message
        );
      }
    }

    console.log("[Migration] Migração concluída");
  },

  down: async (queryInterface: QueryInterface) => {
    const sequelize = queryInterface.sequelize;

    const indexes = [
      "idx_tickets_contact_company_whatsapp",
      "idx_tickets_dedup_group",
      "idx_tickets_company_created",
      "idx_tickets_company_whatsapp_status_updated",
      "idx_messages_unread",
      "idx_tickettraking_company_ticket_id",
      "idx_tickettraking_open",
      "idx_schedules_pending_sendat",
      "idx_whatsapps_fbpage_channel",
      "idx_whatsapps_meta_verify_token",
      "idx_chatmessages_chat_created",
      "idx_chatusers_user",
      "idx_chatusers_chat_user"
    ];

    for (const idx of indexes) {
      try {
        await sequelize.query(`DROP INDEX IF EXISTS ${idx}`, {
          transaction: null
        });
      } catch (err: any) {
        console.log(
          `[Migration] Erro ao remover ${idx} (ignorando):`,
          err.message
        );
      }
    }

    console.log("[Migration] Índices removidos");
  }
};
