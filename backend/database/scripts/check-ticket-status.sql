-- Verificar situação dos tickets no banco

-- 1. Tickets por status
SELECT status, COUNT(*) as total
FROM "Tickets"
GROUP BY status
ORDER BY total DESC;

-- 2. Contatos com múltiplos tickets ABERTOS (problema)
SELECT t."contactId", c.name, c.number, COUNT(*) as ticket_count,
       array_agg(t.id ORDER BY t.id) as ticket_ids,
       array_agg(t.status ORDER BY t.id) as statuses
FROM "Tickets" t
JOIN "Contacts" c ON c.id = t."contactId"
WHERE t.status NOT IN ('closed')
GROUP BY t."contactId", c.name, c.number
HAVING COUNT(*) > 1
LIMIT 20;

-- 3. Mensagens em tickets fechados (últimos 30 dias)
SELECT COUNT(*) as msgs_in_closed_tickets
FROM "Messages" m
JOIN "Tickets" t ON t.id = m."ticketId"
WHERE t.status = 'closed'
AND m."createdAt" > NOW() - INTERVAL '30 days';
