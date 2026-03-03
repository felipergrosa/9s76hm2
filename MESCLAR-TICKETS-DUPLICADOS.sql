-- VERIFICAÇÃO E MESCLAGEM DE TICKETS DUPLICADOS
-- Tickets: 6c1e9d3c-9519-4a3a-af59-dfaae32eeefa e 61be5652-f66e-41b2-9886-f49ca3a80ea8

-- 1. Analisar os dois tickets
SELECT 
  t.id,
  t.uuid,
  t.status,
  t."contactId",
  t."whatsappId",
  c.name as contato_nome,
  c.number as contato_numero,
  c."remoteJid",
  t."createdAt",
  t."updatedAt",
  t."lastMessage",
  t."unreadMessages"
FROM "Tickets" t
JOIN "Contacts" c ON t."contactId" = c.id
WHERE t.uuid IN ('6c1e9d3c-9519-4a3a-af59-dfaae32eeefa', '61be5652-f66e-41b2-9886-f49ca3a80ea8')
ORDER BY t."createdAt";

-- 2. Verificar mensagens de cada ticket
SELECT 
  t.uuid as ticket_uuid,
  COUNT(m.id) as total_mensagens,
  MIN(m."createdAt") as primeira_msg,
  MAX(m."createdAt") as ultima_msg,
  COUNT(CASE WHEN m."fromMe" = false THEN 1 END) as msgs_recebidas,
  COUNT(CASE WHEN m."fromMe" = true THEN 1 END) as msgs_enviadas
FROM "Tickets" t
LEFT JOIN "Messages" m ON t.id = m."ticketId"
WHERE t.uuid IN ('6c1e9d3c-9519-4a3a-af59-dfaae32eeefa', '61be5652-f66e-41b2-9886-f49ca3a80ea8')
GROUP BY t.uuid
ORDER BY t."createdAt";

-- 3. Identificar tickets duplicados (mesmo contato + mesma conexão)
WITH tickets_duplicados AS (
  SELECT 
    c.id as contact_id,
    c.number,
    t."whatsappId",
    COUNT(t.id) as total_tickets,
    STRING_AGG(t.uuid::TEXT, ', ' ORDER BY t."createdAt") as ticket_uuids,
    STRING_AGG(t.id::TEXT, ', ' ORDER BY t."createdAt") as ticket_ids,
    MIN(t.id) as ticket_principal_id,
    MIN(t.uuid) as ticket_principal_uuid
  FROM "Tickets" t
  JOIN "Contacts" c ON t."contactId" = c.id
  WHERE t."whatsappId" = 16
    AND t."companyId" = 1
    AND t.status != 'closed'
  GROUP BY c.id, c.number, t."whatsappId"
  HAVING COUNT(t.id) > 1
)
SELECT * FROM tickets_duplicados;

-- 4. MESCLAR TICKETS DUPLICADOS
BEGIN;

-- 4.1 Mover mensagens do ticket secundário para o principal
UPDATE "Messages"
SET "ticketId" = td.ticket_principal_id
FROM tickets_duplicados td
WHERE "ticketId" = ANY(STRING_TO_ARRAY(td.ticket_ids, ',')::INTEGER[])
  AND "ticketId" != td.ticket_principal_id;

-- 4.2 Mover transferências de fila (se existir tabela TicketTraking)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'TicketTrackings' 
      AND table_schema = 'public'
  ) THEN
    UPDATE "TicketTrackings"
    SET "ticketId" = td.ticket_principal_id
    FROM tickets_duplicados td
    WHERE "ticketId" = ANY(STRING_TO_ARRAY(td.ticket_ids, ',')::INTEGER[])
      AND "ticketId" != td.ticket_principal_id;
  END IF;
END $$;

-- 4.3 Atualizar status do ticket principal (manter o mais recente)
UPDATE "Tickets"
SET 
  status = CASE 
    WHEN EXISTS(SELECT 1 FROM "Tickets" t2 WHERE t2.id = td.ticket_principal_id AND t2.status = 'open') THEN 'open'
    ELSE 'pending'
  END,
  "updatedAt" = NOW()
FROM tickets_duplicados td
WHERE id = td.ticket_principal_id;

-- 4.4 Deletar tickets secundários
DELETE FROM "Tickets"
WHERE id = ANY(STRING_TO_ARRAY(td.ticket_ids, ',')::INTEGER[])
  AND id != td.ticket_principal_id;

COMMIT;

-- 5. VERIFICAÇÃO PÓS-MESCLAGEM
-- Verificar se os tickets foram mesclados
SELECT 
  t.id,
  t.uuid,
  t.status,
  c.name as contato_nome,
  c.number,
  COUNT(m.id) as total_mensagens,
  t."createdAt",
  t."updatedAt"
FROM "Tickets" t
JOIN "Contacts" c ON t."contactId" = c.id
LEFT JOIN "Messages" m ON t.id = m."ticketId"
WHERE t.uuid IN ('6c1e9d3c-9519-4a3a-af59-dfaae32eeefa', '61be5652-f66e-41b2-9886-f49ca3a80ea8')
  OR (t."contactId" IN (
    SELECT "contactId" FROM "Tickets" 
    WHERE uuid IN ('6c1e9d3c-9519-4a3a-af59-dfaae32eeefa', '61be5652-f66e-41b2-9886-f49ca3a80ea8')
  ))
GROUP BY t.id, t.uuid, t.status, c.name, c.number, t."createdAt", t."updatedAt"
ORDER BY t."createdAt";

-- 6. Verificar todos os tickets duplicados restantes
WITH tickets_duplicados_restantes AS (
  SELECT 
    c.name as contato_nome,
    c.number,
    COUNT(t.id) as total_tickets,
    STRING_AGG(t.uuid::TEXT, ', ' ORDER BY t."createdAt") as tickets_uuids
  FROM "Tickets" t
  JOIN "Contacts" c ON t."contactId" = c.id
  WHERE t."whatsappId" = 16
    AND t."companyId" = 1
    AND t.status != 'closed'
  GROUP BY c.id, c.name, c.number
  HAVING COUNT(t.id) > 1
)
SELECT * FROM tickets_duplicados_restantes;
