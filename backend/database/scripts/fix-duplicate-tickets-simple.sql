-- =============================================================================
-- SCRIPT SIMPLES: Unificar Tickets Duplicados
-- =============================================================================
-- Executar diretamente no banco (DBeaver, pgAdmin, etc)
-- =============================================================================

-- PASSO 0: Verificar duplicados
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
-- EXECUTAR OS PASSOS ABAIXO UM POR UM (copiar e colar cada bloco)
-- =============================================================================

-- PASSO 1: Mover mensagens dos tickets antigos para o mais recente
UPDATE "Messages" m
SET "ticketId" = sub.keep_ticket_id
FROM (
  SELECT 
    dg.id as old_ticket_id, 
    kt.id as keep_ticket_id
  FROM "Tickets" dg
  JOIN "Tickets" kt ON dg."contactId" = kt."contactId" 
      AND dg."whatsappId" = kt."whatsappId"
      AND dg."companyId" = kt."companyId"
      AND dg.id < kt.id
  WHERE dg."contactId" IS NOT NULL 
    AND dg."whatsappId" IS NOT NULL
    AND dg."isGroup" = false
    AND kt."isGroup" = false
) sub
WHERE m."ticketId" = sub.old_ticket_id;

-- PASSO 2: Atualizar unreadMessages e updatedAt do ticket mantido
UPDATE "Tickets" t
SET 
  "unreadMessages" = COALESCE(t."unreadMessages", 0) + COALESCE(sub.total_unread, 0),
  "updatedAt" = GREATEST(t."updatedAt", sub.max_updated)
FROM (
  SELECT 
    kt.id as keep_ticket_id,
    SUM(COALESCE(dg."unreadMessages", 0)) as total_unread,
    MAX(dg."updatedAt") as max_updated
  FROM "Tickets" dg
  JOIN "Tickets" kt ON dg."contactId" = kt."contactId" 
      AND dg."whatsappId" = kt."whatsappId"
      AND dg."companyId" = kt."companyId"
      AND dg.id < kt.id
  WHERE dg."contactId" IS NOT NULL 
    AND dg."whatsappId" IS NOT NULL
    AND dg."isGroup" = false
    AND kt."isGroup" = false
  GROUP BY kt.id
) sub
WHERE t.id = sub.keep_ticket_id;

-- PASSO 3: Remover tickets duplicados (antigos)
DELETE FROM "Tickets" t
USING (
  SELECT dg.id as old_ticket_id
  FROM "Tickets" dg
  JOIN "Tickets" kt ON dg."contactId" = kt."contactId" 
      AND dg."whatsappId" = kt."whatsappId"
      AND dg."companyId" = kt."companyId"
      AND dg.id < kt.id
  WHERE dg."contactId" IS NOT NULL 
    AND dg."whatsappId" IS NOT NULL
    AND dg."isGroup" = false
    AND kt."isGroup" = false
) sub
WHERE t.id = sub.old_ticket_id;

-- PASSO 4: Verificar resultado (deve retornar vazio)
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
