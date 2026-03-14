-- ═══════════════════════════════════════════════════════════════════
-- OTIMIZAÇÃO DE PERFORMANCE - TICKETS
-- Baseado em diagnóstico: query withUnreadMessages levando 834ms
-- ═══════════════════════════════════════════════════════════════════

-- Verificar índices existentes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'Tickets'
ORDER BY indexname;

-- ═══════════════════════════════════════════════════════════════════
-- ÍNDICES CRÍTICOS PARA QUERIES LENTAS
-- ═══════════════════════════════════════════════════════════════════

-- 1. Índice composto para withUnreadMessages (834ms → ~100ms)
-- Query: WHERE companyId AND status NOT IN (...) AND queueId IN (...) AND unreadMessages > 0
CREATE INDEX IF NOT EXISTS idx_tickets_unread_messages 
ON "Tickets"("companyId", "unreadMessages", "status", "queueId")
WHERE "unreadMessages" > 0;

-- 2. Índice para userId + status (queries por usuário)
CREATE INDEX IF NOT EXISTS idx_tickets_user_status 
ON "Tickets"("companyId", "userId", "status", "updatedAt" DESC);

-- 3. Índice para queueId + updatedAt (ordenação frequente)
CREATE INDEX IF NOT EXISTS idx_tickets_queue_updated 
ON "Tickets"("companyId", "queueId", "updatedAt" DESC);

-- 4. Índice para grupos (status=group com 532ms)
CREATE INDEX IF NOT EXISTS idx_tickets_groups 
ON "Tickets"("companyId", "status", "isGroup", "whatsappId")
WHERE "status" = 'group';

-- 5. Índice para contactId (JOINs com Contacts)
CREATE INDEX IF NOT EXISTS idx_tickets_contact 
ON "Tickets"("contactId", "companyId");

-- 6. Índice parcial para tickets pendentes
CREATE INDEX IF NOT EXISTS idx_tickets_pending 
ON "Tickets"("companyId", "queueId", "updatedAt" DESC)
WHERE "status" = 'pending';

-- 7. Índice parcial para tickets abertos
CREATE INDEX IF NOT EXISTS idx_tickets_open 
ON "Tickets"("companyId", "userId", "queueId", "updatedAt" DESC)
WHERE "status" = 'open';

-- ═══════════════════════════════════════════════════════════════════
-- ÍNDICES EM TABELAS RELACIONADAS
-- ═══════════════════════════════════════════════════════════════════

-- Contacts (usado em JOINS)
CREATE INDEX IF NOT EXISTS idx_contacts_company 
ON "Contacts"("companyId", "id");

-- Messages (para busca por mensagens)
CREATE INDEX IF NOT EXISTS idx_messages_ticket_body 
ON "Messages"("ticketId", "body")
WHERE "body" IS NOT NULL;

-- TicketTags (para filtros por tags)
CREATE INDEX IF NOT EXISTS idx_ticket_tags_ticket 
ON "TicketTags"("ticketId", "tagId");

-- ContactTags (para permissões por tags)
CREATE INDEX IF NOT EXISTS idx_contact_tags_contact 
ON "ContactTags"("contactId", "tagId");

-- ═══════════════════════════════════════════════════════════════════
-- ANÁLISE DE PERFORMANCE
-- ═══════════════════════════════════════════════════════════════════

-- Verificar tamanho das tabelas
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE tablename IN ('Tickets', 'Contacts', 'Messages', 'TicketTags')
ORDER BY size_bytes DESC;

-- Verificar queries lentas (se pg_stat_statements estiver ativo)
-- SELECT 
--     query,
--     calls,
--     mean_exec_time,
--     max_exec_time
-- FROM pg_stat_statements
-- WHERE query LIKE '%Tickets%'
-- ORDER BY mean_exec_time DESC
-- LIMIT 10;

-- ═══════════════════════════════════════════════════════════════════
-- VACUUM E ANALYZE (Importante após criar índices)
-- ═══════════════════════════════════════════════════════════════════

VACUUM ANALYZE "Tickets";
VACUUM ANALYZE "Contacts";
VACUUM ANALYZE "Messages";
VACUUM ANALYZE "TicketTags";
VACUUM ANALYZE "ContactTags";

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'Tickets'
  AND indexname LIKE 'idx_%'
ORDER BY indexname;

-- ═══════════════════════════════════════════════════════════════════
-- EXPLICAÇÃO DOS GANHOS ESPERADOS:
-- ═══════════════════════════════════════════════════════════════════
-- 
-- Query withUnreadMessages: 834ms → ~150ms (82% mais rápido)
-- Query status=group: 532ms → ~80ms (85% mais rápido)
-- Query ticket individual: 735ms → ~50ms (93% mais rápido)
-- Outras queries: 380-420ms → ~60-100ms (75% mais rápido)
--
-- TOTAL: Redução de ~80% no tempo de resposta da API
-- ═══════════════════════════════════════════════════════════════════
