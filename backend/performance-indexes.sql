-- ============================================================
-- MIGRATION: Performance Indexes for Whaticket
-- Execute este script no PostgreSQL para otimizar queries
-- Data: 2026-01-22
-- ============================================================

-- 1. Índice composto principal para listagem de tickets por status
-- Usado em: ListTicketsService, TicketsQueuesService
CREATE
INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_company_status_updated ON "Tickets" (
    "companyId",
    "status",
    "updatedAt" DESC
);

-- 2. Índice para busca de tickets por contato
-- Usado em: busca por número, histórico de conversas
CREATE
INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_company_contact ON "Tickets" ("companyId", "contactId");

-- 3. Índice para filtro por usuário e fila (atendente)
-- Usado em: ListTicketsService quando filtra por userId/queueId
CREATE
INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_company_user_queue ON "Tickets" (
    "companyId",
    "userId",
    "queueId"
);

-- 4. Índice para tickets pendentes (muito acessado)
CREATE
INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_pending_queue ON "Tickets" (
    "companyId",
    "queueId",
    "status"
)
WHERE
    status = 'pending';

-- 5. Índice para mensagens por ticket (ordenação por data)
-- Usado em: carregar histórico de mensagens
CREATE
INDEX CONCURRENTLY IF NOT EXISTS idx_messages_ticket_created ON "Messages" ("ticketId", "createdAt" DESC);

-- 6. Índice para busca em corpo de mensagens (ILIKE)
-- Usado em: busca de tickets por conteúdo
CREATE
INDEX CONCURRENTLY IF NOT EXISTS idx_messages_body_trgm ON "Messages" USING gin ("body" gin_trgm_ops);

-- 7. Índice para contatos por empresa e número
-- Usado em: FindOrCreateContactService, busca por número
CREATE
INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_company_number ON "Contacts" ("companyId", "number");

-- 8. Índice para busca por nome de contato (ILIKE com unaccent)
CREATE
INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_name_lower ON "Contacts" (lower("name"));

-- 9. Índice para tags de contatos (join frequente)
CREATE
INDEX CONCURRENTLY IF NOT EXISTS idx_contact_tags_contact ON "ContactTags" ("contactId");

CREATE
INDEX CONCURRENTLY IF NOT EXISTS idx_contact_tags_tag ON "ContactTags" ("tagId");

-- 10. Índice para tickets por WhatsApp
CREATE
INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_whatsapp_company ON "Tickets" ("whatsappId", "companyId");

-- 11. Índice para campanhas ativas
CREATE
INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_company_status ON "Campaigns" ("companyId", "status");

-- 12. Índice para envios de campanha
CREATE
INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_shipping_campaign ON "CampaignShippings" ("campaignId", "deliveredAt");

-- 13. Índice para mensagens não lidas
CREATE
INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_unread ON "Tickets" ("companyId", "unreadMessages")
WHERE
    "unreadMessages" > 0;

-- 14. Índice para tickets de grupos
CREATE
INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_groups ON "Tickets" (
    "companyId",
    "isGroup",
    "status"
)
WHERE
    "isGroup" = true;

-- 15. Índice para logs de tickets
CREATE
INDEX CONCURRENTLY IF NOT EXISTS idx_log_tickets_ticket ON "LogTickets" ("ticketId", "createdAt" DESC);

-- Habilitar extensão para busca por trigrama (se não existir)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Atualizar estatísticas das tabelas principais
ANALYZE "Tickets";

ANALYZE "Messages";

ANALYZE "Contacts";

ANALYZE "ContactTags";

ANALYZE "Campaigns";

ANALYZE "CampaignShippings";

-- ============================================================
-- FIM DA MIGRATION
-- Execute VACUUM ANALYZE após para garantir estatísticas atuais
-- ============================================================