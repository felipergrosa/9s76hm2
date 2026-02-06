-- =============================================================================
-- CORREÇÃO DE LIDS USANDO CAMPO remoteJid
-- =============================================================================
-- O campo remoteJid já contém o JID real (@s.whatsapp.net ou @g.us)
-- Podemos usar isso para extrair o número real e corrigir contatos com LID
-- =============================================================================

-- 1. DIAGNÓSTICO: Ver contatos com remoteJid @lid vs @s.whatsapp.net
SELECT 
    id,
    name,
    "number",
    "remoteJid",
    "canonicalNumber",
    "isGroup",
    CASE 
        WHEN "remoteJid" LIKE '%@lid' THEN 'LID'
        WHEN "remoteJid" LIKE '%@s.whatsapp.net' THEN 'REAL'
        WHEN "remoteJid" LIKE '%@g.us' THEN 'GRUPO'
        ELSE 'OUTRO'
    END AS tipo_jid
FROM "Contacts"
WHERE "companyId" = 1
ORDER BY tipo_jid, name;

-- 2. CONTATOS COM LID QUE TÊM NÚMERO GRANDE (15+ dígitos)
-- Estes são os problemáticos que precisamos corrigir
SELECT 
    id,
    name,
    "number",
    "remoteJid",
    LENGTH(REGEXP_REPLACE("number", '[^0-9]', '', 'g')) as digits_count
FROM "Contacts"
WHERE "companyId" = 1
    AND "isGroup" = false
    AND (
        "remoteJid" LIKE '%@lid'
        OR LENGTH(REGEXP_REPLACE("number", '[^0-9]', '', 'g')) >= 14
    )
ORDER BY name;

-- 3. BUSCAR DUPLICADOS: LID + CONTATO REAL COM MESMO NOME
SELECT 
    lid.id as lid_id,
    lid.name as lid_name,
    lid."number" as lid_number,
    lid."remoteJid" as lid_remotejid,
    real.id as real_id,
    real.name as real_name,
    real."number" as real_number,
    real."remoteJid" as real_remotejid
FROM "Contacts" lid
INNER JOIN "Contacts" real 
    ON lid.name = real.name 
    AND lid."companyId" = real."companyId"
    AND lid.id != real.id
WHERE lid."companyId" = 1
    AND lid."isGroup" = false
    AND real."isGroup" = false
    AND (lid."remoteJid" LIKE '%@lid' OR LENGTH(REGEXP_REPLACE(lid."number", '[^0-9]', '', 'g')) >= 14)
    AND real."remoteJid" LIKE '%@s.whatsapp.net'
ORDER BY lid.name;

-- 4. ATUALIZAR CONTATOS LID COM NÚMERO EXTRAÍDO DO remoteJid DE CONTATO REAL
-- (ATENÇÃO: Execute com cuidado!)
/*
UPDATE "Contacts" lid
SET 
    "number" = REGEXP_REPLACE(real."remoteJid", '@s.whatsapp.net$', ''),
    "canonicalNumber" = REGEXP_REPLACE(real."remoteJid", '@s.whatsapp.net$', ''),
    "remoteJid" = real."remoteJid"
FROM "Contacts" real
WHERE lid.name = real.name 
    AND lid."companyId" = real."companyId"
    AND lid.id != real.id
    AND lid."companyId" = 1
    AND lid."isGroup" = false
    AND real."isGroup" = false
    AND (lid."remoteJid" LIKE '%@lid' OR LENGTH(REGEXP_REPLACE(lid."number", '[^0-9]', '', 'g')) >= 14)
    AND real."remoteJid" LIKE '%@s.whatsapp.net';
*/

-- 5. MESCLAR TICKETS DE LID PARA CONTATO REAL (se existirem ambos)
-- Primeiro, identificar pares para mesclagem
SELECT 
    lid.id as lid_contact_id,
    real.id as real_contact_id,
    lid.name,
    (SELECT COUNT(*) FROM "Tickets" WHERE "contactId" = lid.id) as lid_tickets,
    (SELECT COUNT(*) FROM "Tickets" WHERE "contactId" = real.id) as real_tickets
FROM "Contacts" lid
INNER JOIN "Contacts" real 
    ON lid.name = real.name 
    AND lid."companyId" = real."companyId"
    AND lid.id != real.id
WHERE lid."companyId" = 1
    AND lid."isGroup" = false
    AND real."isGroup" = false
    AND (lid."remoteJid" LIKE '%@lid' OR LENGTH(REGEXP_REPLACE(lid."number", '[^0-9]', '', 'g')) >= 14)
    AND real."remoteJid" LIKE '%@s.whatsapp.net';

-- 6. TRANSFERIR TICKETS DO LID PARA O REAL
-- (Substitua LID_ID e REAL_ID pelos IDs corretos)
/*
-- Transferir tickets
UPDATE "Tickets" SET "contactId" = REAL_ID WHERE "contactId" = LID_ID;

-- Transferir mensagens
UPDATE "Messages" SET "contactId" = REAL_ID WHERE "contactId" = LID_ID;

-- Transferir tags
INSERT INTO "ContactTags" ("contactId", "tagId", "createdAt", "updatedAt")
SELECT REAL_ID, "tagId", NOW(), NOW()
FROM "ContactTags" 
WHERE "contactId" = LID_ID
ON CONFLICT ("contactId", "tagId") DO NOTHING;

-- Remover tags do LID
DELETE FROM "ContactTags" WHERE "contactId" = LID_ID;

-- Deletar contato LID
DELETE FROM "Contacts" WHERE id = LID_ID;
*/

-- 7. SCRIPT AUTOMÁTICO PARA MESCLAR TODOS OS DUPLICADOS
-- (Execute com MUITO cuidado - faça backup antes!)
/*
DO $$
DECLARE
    lid_rec RECORD;
    real_rec RECORD;
BEGIN
    FOR lid_rec IN 
        SELECT lid.id as lid_id, lid.name
        FROM "Contacts" lid
        WHERE lid."companyId" = 1
            AND lid."isGroup" = false
            AND (lid."remoteJid" LIKE '%@lid' OR LENGTH(REGEXP_REPLACE(lid."number", '[^0-9]', '', 'g')) >= 14)
    LOOP
        -- Buscar contato real correspondente
        SELECT id INTO real_rec
        FROM "Contacts"
        WHERE name = lid_rec.name
            AND "companyId" = 1
            AND "isGroup" = false
            AND id != lid_rec.lid_id
            AND "remoteJid" LIKE '%@s.whatsapp.net'
        LIMIT 1;
        
        IF real_rec.id IS NOT NULL THEN
            -- Transferir tickets
            UPDATE "Tickets" SET "contactId" = real_rec.id WHERE "contactId" = lid_rec.lid_id;
            
            -- Transferir mensagens
            UPDATE "Messages" SET "contactId" = real_rec.id WHERE "contactId" = lid_rec.lid_id;
            
            -- Transferir tags (ignorando conflitos)
            INSERT INTO "ContactTags" ("contactId", "tagId", "createdAt", "updatedAt")
            SELECT real_rec.id, "tagId", NOW(), NOW()
            FROM "ContactTags" 
            WHERE "contactId" = lid_rec.lid_id
            ON CONFLICT ("contactId", "tagId") DO NOTHING;
            
            -- Remover tags do LID
            DELETE FROM "ContactTags" WHERE "contactId" = lid_rec.lid_id;
            
            -- Deletar contato LID
            DELETE FROM "Contacts" WHERE id = lid_rec.lid_id;
            
            RAISE NOTICE 'Mesclado LID % com REAL %', lid_rec.lid_id, real_rec.id;
        END IF;
    END LOOP;
END $$;
*/

-- 8. VERIFICAÇÃO FINAL
SELECT 
    COUNT(*) as total_lids_restantes
FROM "Contacts"
WHERE "companyId" = 1
    AND "isGroup" = false
    AND ("remoteJid" LIKE '%@lid' OR LENGTH(REGEXP_REPLACE("number", '[^0-9]', '', 'g')) >= 14);
