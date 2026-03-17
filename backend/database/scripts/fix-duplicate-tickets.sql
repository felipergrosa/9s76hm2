-- =============================================================================
-- SCRIPT: Unificar Tickets Duplicados
-- =============================================================================
-- PROBLEMA: O código antigo criava novos tickets ao invés de reabrir tickets
-- fechados, causando duplicatas para o mesmo contato + conexão.
--
-- ESTRATÉGIA:
-- 1. Identificar grupos de tickets duplicados (mesmo contactId + whatsappId + companyId)
-- 2. Manter o ticket mais recente (maior ID) de cada grupo
-- 3. Mover mensagens dos tickets antigos para o ticket mantido
-- 4. Mover outras relações (TicketTraking, etc)
-- 5. Remover tickets duplicados antigos
--
-- EXECUÇÃO:
-- 1. Fazer BACKUP do banco antes de executar!
-- 2. Executar em modo transação (BEGIN/COMMIT)
-- 3. Verificar logs antes de confirmar
-- =============================================================================

-- =============================================================================
-- PASSO 0: VERIFICAR QUANTIDADE DE DUPLICADOS
-- =============================================================================
-- Executar primeiro para ver quantos duplicados existem
SELECT 
    "contactId",
    "whatsappId",
    "companyId",
    COUNT(*) as total_tickets,
    array_agg(id ORDER BY id DESC) as ticket_ids,
    array_agg(status ORDER BY id DESC) as statuses
FROM "Tickets"
WHERE "contactId" IS NOT NULL 
  AND "whatsappId" IS NOT NULL
  AND "isGroup" = false
GROUP BY "contactId", "whatsappId", "companyId"
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- =============================================================================
-- PASSO 1: CRIAR TABELA TEMPORÁRIA COM MAPEAMENTO DE TICKETS
-- =============================================================================
-- Cria tabela temporária para mapear tickets antigos -> ticket mantido
DROP TABLE IF EXISTS ticket_merge_map;

CREATE TEMP TABLE ticket_merge_map AS
WITH duplicate_groups AS (
    SELECT 
        id,
        "contactId",
        "whatsappId",
        "companyId",
        ROW_NUMBER() OVER (
            PARTITION BY "contactId", "whatsappId", "companyId" 
            ORDER BY id DESC
        ) as rn,
        COUNT(*) OVER (
            PARTITION BY "contactId", "whatsappId", "companyId"
        ) as total_count
    FROM "Tickets"
    WHERE "contactId" IS NOT NULL 
      AND "whatsappId" IS NOT NULL
      AND "isGroup" = false
),
keep_tickets AS (
    -- Ticket mais recente de cada grupo (rn = 1)
    SELECT id as keep_ticket_id, "contactId", "whatsappId", "companyId"
    FROM duplicate_groups 
    WHERE rn = 1 AND total_count > 1
),
old_tickets AS (
    -- Tickets antigos a serem removidos (rn > 1)
    SELECT 
        dg.id as old_ticket_id,
        kt.keep_ticket_id
    FROM duplicate_groups dg
    JOIN keep_tickets kt ON dg."contactId" = kt."contactId" 
                        AND dg."whatsappId" = kt."whatsappId"
                        AND dg."companyId" = kt."companyId"
    WHERE dg.rn > 1
)
SELECT * FROM old_tickets;

-- Verificar mapeamento
SELECT COUNT(*) as total_tickets_to_merge FROM ticket_merge_map;
SELECT * FROM ticket_merge_map LIMIT 20;

-- =============================================================================
-- PASSO 2: MOVER MENSAGENS DOS TICKETS ANTIGOS PARA O TICKET MANTIDO
-- =============================================================================
BEGIN;

-- 2.1: Atualizar mensagens
UPDATE "Messages" m
SET "ticketId" = tmm.keep_ticket_id
FROM ticket_merge_map tmm
WHERE m."ticketId" = tmm.old_ticket_id;

-- Verificar quantas mensagens foram movidas
SELECT 
    tmm.old_ticket_id,
    tmm.keep_ticket_id,
    COUNT(m.id) as messages_moved
FROM ticket_merge_map tmm
LEFT JOIN "Messages" m ON m."ticketId" = tmm.old_ticket_id
GROUP BY tmm.old_ticket_id, tmm.keep_ticket_id
LIMIT 20;

-- =============================================================================
-- PASSO 3: MOVER OUTRAS RELAÇÕES
-- =============================================================================

-- 3.1: TicketTraking (histórico de acompanhamento)
UPDATE "TicketTrackings" tt
SET "ticketId" = tmm.keep_ticket_id
FROM ticket_merge_map tmm
WHERE tt."ticketId" = tmm.old_ticket_id;

-- 3.2: TicketTags (tags do ticket)
UPDATE "TicketTags" tt
SET "ticketId" = tmm.keep_ticket_id
FROM ticket_merge_map tmm
WHERE tt."ticketId" = tmm.old_ticket_id;

-- 3.3: TicketLogMessages (logs de mensagens)
UPDATE "TicketLogMessages" tlm
SET "ticketId" = tmm.keep_ticket_id
FROM ticket_merge_map tmm
WHERE tlm."ticketId" = tmm.old_ticket_id;

-- 3.4: UserRatings (avaliações)
UPDATE "UserRatings" ur
SET "ticketId" = tmm.keep_ticket_id
FROM ticket_merge_map tmm
WHERE ur."ticketId" = tmm.old_ticket_id;

-- 3.5: LogTickets (logs do ticket)
UPDATE "LogTickets" lt
SET "ticketId" = tmm.keep_ticket_id
FROM ticket_merge_map tmm
WHERE lt."ticketId" = tmm.old_ticket_id;

-- =============================================================================
-- PASSO 4: ATUALIZAR DADOS DO TICKET MANTIDO
-- =============================================================================
-- O ticket mantido deve ter o status mais recente e unreadMessages somado

UPDATE "Tickets" t
SET 
    "unreadMessages" = COALESCE(t."unreadMessages", 0) + COALESCE(agg.total_unread, 0),
    "updatedAt" = GREATEST(t."updatedAt", agg.max_updated)
FROM (
    SELECT 
        tmm.keep_ticket_id,
        SUM(COALESCE(t2."unreadMessages", 0)) as total_unread,
        MAX(t2."updatedAt") as max_updated
    FROM ticket_merge_map tmm
    JOIN "Tickets" t2 ON t2.id = tmm.old_ticket_id
    GROUP BY tmm.keep_ticket_id
) agg
WHERE t.id = agg.keep_ticket_id;

-- =============================================================================
-- PASSO 5: REMOVER TICKETS DUPLICADOS ANTIGOS
-- =============================================================================
-- Verificar se há mensagens órfãs antes de deletar
SELECT COUNT(*) as orphan_messages FROM "Messages" m
JOIN ticket_merge_map tmm ON m."ticketId" = tmm.old_ticket_id;

-- Se count = 0, pode deletar com segurança
DELETE FROM "Tickets" t
USING ticket_merge_map tmm
WHERE t.id = tmm.old_ticket_id;

-- =============================================================================
-- PASSO 6: VERIFICAR RESULTADO
-- =============================================================================
-- Verificar se ainda existem duplicados
SELECT 
    "contactId",
    "whatsappId",
    "companyId",
    COUNT(*) as total_tickets
FROM "Tickets"
WHERE "contactId" IS NOT NULL 
  AND "whatsappId" IS NOT NULL
  AND "isGroup" = false
GROUP BY "contactId", "whatsappId", "companyId"
HAVING COUNT(*) > 1;

-- Se retornar vazio, não há mais duplicados!

-- =============================================================================
-- CONFIRMAR OU REVERTER
-- =============================================================================
-- Se tudo estiver correto:
COMMIT;

-- Se houver problema:
-- ROLLBACK;

-- =============================================================================
-- LIMPEZA
-- =============================================================================
DROP TABLE IF EXISTS ticket_merge_map;

-- =============================================================================
-- RELATÓRIO FINAL
-- =============================================================================
SELECT 
    'Antes' as momento,
    'Verificar contagem no log acima' as info
UNION ALL
SELECT 
    'Depois' as momento,
    'Verificar se query de duplicados retornou vazio' as info;
