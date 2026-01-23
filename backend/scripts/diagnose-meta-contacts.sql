-- ============================================================
-- DIAGNÓSTICO: Contatos com IDs Meta (números > 13 dígitos)
-- Execute este script para identificar contatos problemáticos
-- Data: 2026-01-22
-- ============================================================

-- 1. Listar todos os contatos com números muito longos (IDs Meta)
SELECT
    c.id AS contact_id,
    c.name,
    c.number,
    LENGTH (c.number) AS num_length,
    c."companyId",
    c."createdAt",
    (
        SELECT COUNT(*)
        FROM "Tickets" t
        WHERE
            t."contactId" = c.id
    ) AS ticket_count,
    (
        SELECT COUNT(*)
        FROM "Messages" m
        WHERE
            m."contactId" = c.id
    ) AS message_count
FROM "Contacts" c
WHERE
    c."isGroup" = false
    AND LENGTH (c.number) > 13
ORDER BY c."companyId", c.name;

-- 2. Contar quantos contatos problemáticos existem por empresa
SELECT c."companyId", COUNT(*) AS meta_id_contacts
FROM "Contacts" c
WHERE
    c."isGroup" = false
    AND LENGTH (c.number) > 13
GROUP BY
    c."companyId"
ORDER BY meta_id_contacts DESC;

-- 3. Encontrar possíveis duplicatas (mesmo nome, números diferentes)
SELECT
    c1.id AS meta_contact_id,
    c1.name,
    c1.number AS meta_number,
    LENGTH (c1.number) AS meta_length,
    c2.id AS real_contact_id,
    c2.number AS real_number,
    LENGTH (c2.number) AS real_length,
    c1."companyId"
FROM
    "Contacts" c1
    INNER JOIN "Contacts" c2 ON c1.name = c2.name
    AND c1."companyId" = c2."companyId"
    AND c1.id <> c2.id
    AND c1."isGroup" = false
    AND c2."isGroup" = false
WHERE
    LENGTH (c1.number) > 13 -- c1 é o contato com ID Meta
    AND LENGTH (c2.number) <= 13 -- c2 é o contato real
ORDER BY c1."companyId", c1.name;

-- ============================================================
-- FIM DO DIAGNÓSTICO
-- Use os resultados para decidir quais contatos fazer merge
-- ============================================================