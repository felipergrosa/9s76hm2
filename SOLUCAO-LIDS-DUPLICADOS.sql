-- ========================================================================
-- SCRIPT PARA RESOLVER DUPLICADOS CAUSADOS POR LIDs NÃO RESOLVIDOS
-- ========================================================================
-- 
-- PROBLEMA: Contatos LID temporários (ex: 249593652629520@lid) criados
-- quando o Baileys não consegue resolver o LID para número real.
-- Isso gera duplicados do mesmo contato.
--
-- SOLUÇÃO: Este script identifica e mescla automaticamente os duplicados.
--
-- ⚠️ BACKUP: Faça backup do banco ANTES de executar!
-- ⚠️ TESTE: Execute primeiro em ambiente de desenvolvimento!
-- ========================================================================

BEGIN;

-- ========================================================================
-- PASSO 1: LISTAR CONTATOS LID PARA ANÁLISE
-- ========================================================================

SELECT 
    id,
    name,
    number,
    "companyId",
    "createdAt"
FROM "Contacts"
WHERE number LIKE '%@lid'
ORDER BY "createdAt" DESC;

-- ========================================================================
-- PASSO 2: IDENTIFICAR TICKETS ÓRFÃOS (contatos LID)
-- ========================================================================

SELECT 
    t.id AS ticket_id,
    t.uuid AS ticket_uuid,
    t.status,
    c.id AS contact_id,
    c.name AS contact_name,
    c.number AS contact_number,
    COUNT(m.id) AS message_count
FROM "Tickets" t
INNER JOIN "Contacts" c ON t."contactId" = c.id
LEFT JOIN "Messages" m ON m."ticketId" = t.id
WHERE c.number LIKE '%@lid'
GROUP BY t.id, t.uuid, t.status, c.id, c.name, c.number
ORDER BY t."createdAt" DESC;

-- ========================================================================
-- PASSO 3: FUNÇÃO PARA MESCLAR CONTATOS (LID → REAL)
-- ========================================================================

CREATE OR REPLACE FUNCTION merge_lid_contacts(
    p_lid_contact_id INTEGER,
    p_real_contact_id INTEGER
) RETURNS TEXT AS $$
DECLARE
    v_affected_tickets INTEGER;
    v_affected_messages INTEGER;
    v_affected_tags INTEGER;
BEGIN
    -- Atualizar tickets para apontar para o contato real
    UPDATE "Tickets"
    SET "contactId" = p_real_contact_id
    WHERE "contactId" = p_lid_contact_id;
    
    GET DIAGNOSTICS v_affected_tickets = ROW_COUNT;
    
    -- Atualizar mensagens para apontar para o contato real
    UPDATE "Messages"
    SET "contactId" = p_real_contact_id
    WHERE "contactId" = p_lid_contact_id;
    
    GET DIAGNOSTICS v_affected_messages = ROW_COUNT;
    
    -- Copiar tags do contato LID para o real (evitando duplicatas)
    INSERT INTO "ContactTags" ("contactId", "tagId", "createdAt", "updatedAt")
    SELECT p_real_contact_id, "tagId", NOW(), NOW()
    FROM "ContactTags"
    WHERE "contactId" = p_lid_contact_id
    ON CONFLICT ("contactId", "tagId") DO NOTHING;
    
    GET DIAGNOSTICS v_affected_tags = ROW_COUNT;
    
    -- Remover o contato LID temporário
    DELETE FROM "ContactTags" WHERE "contactId" = p_lid_contact_id;
    DELETE FROM "Contacts" WHERE id = p_lid_contact_id;
    
    RETURN FORMAT(
        'Contato LID %s mesclado com contato real %s | Tickets: %s | Mensagens: %s | Tags: %s',
        p_lid_contact_id,
        p_real_contact_id,
        v_affected_tickets,
        v_affected_messages,
        v_affected_tags
    );
END;
$$ LANGUAGE plpgsql;

-- ========================================================================
-- PASSO 4: IDENTIFICAR DUPLICADOS POTENCIAIS
-- ========================================================================

-- Busca contatos LID que podem ter um contato real correspondente
-- baseado em nome similar e mesmo companyId

SELECT 
    lid.id AS lid_contact_id,
    lid.name AS lid_name,
    lid.number AS lid_number,
    real.id AS real_contact_id,
    real.name AS real_name,
    real.number AS real_number,
    similarity(lid.name, real.name) AS name_similarity
FROM "Contacts" lid
INNER JOIN "Contacts" real ON 
    lid."companyId" = real."companyId"
    AND lid.id != real.id
    AND real.number NOT LIKE '%@lid'
    AND similarity(lid.name, real.name) > 0.7
WHERE lid.number LIKE '%@lid'
ORDER BY similarity(lid.name, real.name) DESC;

-- ========================================================================
-- PASSO 5: EXEMPLO DE MESCLAGEM MANUAL
-- ========================================================================

-- Substitua os IDs pelos identificados na query acima
-- SELECT merge_lid_contacts(18275, 812); -- Exemplo: LID → Real

-- ========================================================================
-- PASSO 6: MESCLAGEM AUTOMÁTICA (CUIDADO!)
-- ========================================================================

-- ⚠️ EXECUTAR APENAS APÓS REVISAR OS DUPLICADOS IDENTIFICADOS!
-- Esta query mescla automaticamente contatos com nome exatamente igual

DO $$
DECLARE
    r RECORD;
    v_result TEXT;
BEGIN
    FOR r IN (
        SELECT 
            lid.id AS lid_contact_id,
            real.id AS real_contact_id,
            lid.name AS lid_name,
            real.name AS real_name
        FROM "Contacts" lid
        INNER JOIN "Contacts" real ON 
            lid."companyId" = real."companyId"
            AND lid.id != real.id
            AND real.number NOT LIKE '%@lid'
            AND LOWER(TRIM(lid.name)) = LOWER(TRIM(real.name))
        WHERE lid.number LIKE '%@lid'
    )
    LOOP
        BEGIN
            v_result := merge_lid_contacts(r.lid_contact_id, r.real_contact_id);
            RAISE NOTICE '%', v_result;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'ERRO ao mesclar % com %: %', 
                    r.lid_contact_id, r.real_contact_id, SQLERRM;
        END;
    END LOOP;
END $$;

-- ========================================================================
-- PASSO 7: LIMPAR CONTATOS LID ÓRFÃOS (SEM TICKETS)
-- ========================================================================

-- Contatos LID que não têm tickets associados podem ser removidos com segurança

DELETE FROM "Contacts"
WHERE 
    number LIKE '%@lid'
    AND id NOT IN (SELECT DISTINCT "contactId" FROM "Tickets")
    AND id NOT IN (SELECT DISTINCT "contactId" FROM "Messages");

-- ========================================================================
-- PASSO 8: VERIFICAR RESULTADO
-- ========================================================================

-- Contar quantos contatos LID ainda existem
SELECT 
    "companyId",
    COUNT(*) AS lid_contacts_remaining
FROM "Contacts"
WHERE number LIKE '%@lid'
GROUP BY "companyId";

-- Listar tickets que ainda têm contatos LID
SELECT 
    t.id AS ticket_id,
    t.uuid AS ticket_uuid,
    c.id AS contact_id,
    c.name AS contact_name,
    c.number AS lid_number
FROM "Tickets" t
INNER JOIN "Contacts" c ON t."contactId" = c.id
WHERE c.number LIKE '%@lid'
ORDER BY t."createdAt" DESC;

COMMIT;

-- ========================================================================
-- PASSO 9: ROLLBACK (SE NECESSÁRIO)
-- ========================================================================

-- Se algo deu errado, execute:
-- ROLLBACK;

-- ========================================================================
-- NOTAS IMPORTANTES
-- ========================================================================

-- 1. SEMPRE faça backup antes de executar
-- 2. Execute primeiro em ambiente de DEV
-- 3. Revise os duplicados identificados antes da mesclagem automática
-- 4. A função merge_lid_contacts() pode ser usada manualmente
-- 5. Após executar, teste no frontend se os tickets estão corretos
-- 6. Monitore os logs do backend para novos LIDs sendo criados

-- ========================================================================
-- PREVENÇÃO FUTURA
-- ========================================================================

-- Após executar este script, implemente as correções no backend:
-- 1. Use o serviço ResolveLidToRealNumber.ts
-- 2. Configure endpoints /contacts/lid-resolve-batch
-- 3. Execute periodicamente para evitar acúmulo de LIDs
