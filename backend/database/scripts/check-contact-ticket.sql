-- Verificar tickets do contato 556392485665
SELECT t.id, t.status, t."userId", t."queueId", t."whatsappId", c.name as "contactName", c.number as "contactNumber"
FROM "Tickets" t 
JOIN "Contacts" c ON t."contactId" = c.id 
WHERE c.number LIKE '%556392485665%' 
ORDER BY t.id DESC 
LIMIT 5;
