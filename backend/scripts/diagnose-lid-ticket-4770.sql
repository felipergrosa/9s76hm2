-- ============================================================
-- DIAGNÓSTICO: Ticket #4770 - LID não resolvido
-- ============================================================

-- 1. Dados do ticket
SELECT t.id, t."contactId", t."whatsappId", t.status, t."isGroup", t."lastMessage"
FROM "Tickets" t WHERE t.id = 4770;

-- 2. Dados do contato associado
SELECT c.id, c.name, c.number, c."remoteJid", c."lidJid", c."canonicalNumber", c."companyId"
FROM "Contacts" c
JOIN "Tickets" t ON t."contactId" = c.id
WHERE t.id = 4770;

-- 3. Existe mapeamento LID na tabela LidMappings?
SELECT lm.*
FROM "LidMappings" lm
WHERE lm.lid = '200356113969182@lid' AND lm."companyId" = 1;

-- 4. Existe algum contato com esse LID no remoteJid?
SELECT id, name, number, "remoteJid", "lidJid", "canonicalNumber"
FROM "Contacts"
WHERE "remoteJid" LIKE '%200356113969182%'
   OR "lidJid" LIKE '%200356113969182%'
   OR number LIKE '%200356113969182%';

-- 5. Quantos contatos com LID existem na empresa?
SELECT COUNT(*) AS total_lid_contacts
FROM "Contacts"
WHERE "companyId" = 1
  AND ("remoteJid" LIKE '%@lid' OR number LIKE 'PENDING_%');

-- 6. Quantos mapeamentos LID existem?
SELECT COUNT(*) AS total_mappings FROM "LidMappings" WHERE "companyId" = 1;
