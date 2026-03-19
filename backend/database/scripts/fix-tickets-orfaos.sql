UPDATE "Tickets" t
SET "isGroup" = false, "updatedAt" = NOW()
FROM "Contacts" c
WHERE c.id = t."contactId"
AND t."isGroup" = true
AND c."isGroup" = false;

SELECT 'Tickets corrigidos' as resultado, COUNT(*) as quantidade
FROM "Tickets" t
JOIN "Contacts" c ON c.id = t."contactId"
WHERE t."isGroup" = true AND c."isGroup" = false;
