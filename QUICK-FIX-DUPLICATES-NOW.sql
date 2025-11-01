-- ========================================
-- CORREÇÃO RÁPIDA: Normalizar e Mesclar Duplicados
-- Data: 30/10/2025
-- ========================================

-- ATENÇÃO: Execute SOMENTE após fazer BACKUP!
-- docker exec postgres pg_dump -U postgres whaticket > backup_$(date +%Y%m%d_%H%M%S).sql

BEGIN;

-- ========================================
-- PASSO 1: Normalizar todos os contatos
-- ========================================

UPDATE "Contacts" c
SET 
  "canonicalNumber" = (
    CASE
      -- Remove não-dígitos e zeros à esquerda
      WHEN ltrim(regexp_replace(c.number, '\D', '', 'g'), '0') IS NULL 
        OR ltrim(regexp_replace(c.number, '\D', '', 'g'), '0') = '' THEN NULL
      
      -- Se tem 10-11 dígitos e não começa com DDI, adiciona 55 (Brasil)
      WHEN length(ltrim(regexp_replace(c.number, '\D', '', 'g'), '0')) BETWEEN 10 AND 11 
        AND NOT (ltrim(regexp_replace(c.number, '\D', '', 'g'), '0') ~ '^(1|54|55)') THEN
        '55' || ltrim(regexp_replace(c.number, '\D', '', 'g'), '0')
      
      -- Se é BR (55) com 10 dígitos nacionais e celular sem 9, adiciona
      WHEN substring(ltrim(regexp_replace(c.number, '\D', '', 'g'), '0') FROM 1 FOR 2) = '55'
        AND length(substring(ltrim(regexp_replace(c.number, '\D', '', 'g'), '0') FROM 5)) = 8
        AND substring(ltrim(regexp_replace(c.number, '\D', '', 'g'), '0') FROM 5 FOR 1) ~ '[6-9]' THEN
        '55' || substring(ltrim(regexp_replace(c.number, '\D', '', 'g'), '0') FROM 3 FOR 2) || '9' || substring(ltrim(regexp_replace(c.number, '\D', '', 'g'), '0') FROM 5)
      
      -- Caso padrão
      ELSE ltrim(regexp_replace(c.number, '\D', '', 'g'), '0')
    END
  ),
  number = (
    CASE
      WHEN ltrim(regexp_replace(c.number, '\D', '', 'g'), '0') IS NULL 
        OR ltrim(regexp_replace(c.number, '\D', '', 'g'), '0') = '' THEN c.number
      WHEN length(ltrim(regexp_replace(c.number, '\D', '', 'g'), '0')) BETWEEN 10 AND 11 
        AND NOT (ltrim(regexp_replace(c.number, '\D', '', 'g'), '0') ~ '^(1|54|55)') THEN
        '55' || ltrim(regexp_replace(c.number, '\D', '', 'g'), '0')
      WHEN substring(ltrim(regexp_replace(c.number, '\D', '', 'g'), '0') FROM 1 FOR 2) = '55'
        AND length(substring(ltrim(regexp_replace(c.number, '\D', '', 'g'), '0') FROM 5)) = 8
        AND substring(ltrim(regexp_replace(c.number, '\D', '', 'g'), '0') FROM 5 FOR 1) ~ '[6-9]' THEN
        '55' || substring(ltrim(regexp_replace(c.number, '\D', '', 'g'), '0') FROM 3 FOR 2) || '9' || substring(ltrim(regexp_replace(c.number, '\D', '', 'g'), '0') FROM 5)
      ELSE ltrim(regexp_replace(c.number, '\D', '', 'g'), '0')
    END
  )
WHERE c."isGroup" = false
  AND c.number IS NOT NULL
  AND c.number != ''
  AND (
    c."canonicalNumber" IS NULL 
    OR c."canonicalNumber" = '' 
    OR c."canonicalNumber" != c.number
  );

-- Ver quantos foram normalizados
DO $$ 
DECLARE 
  normalized_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO normalized_count 
  FROM "Contacts" 
  WHERE "isGroup" = false 
    AND "canonicalNumber" IS NOT NULL 
    AND "canonicalNumber" != '';
  
  RAISE NOTICE '✅ Total de contatos normalizados: %', normalized_count;
END $$;

-- ========================================
-- PASSO 2: Identificar duplicados
-- ========================================

CREATE TEMP TABLE duplicates_to_merge AS
SELECT 
  "canonicalNumber",
  "companyId",
  array_agg(id ORDER BY 
    CASE 
      WHEN name IS NOT NULL AND name != '' AND name ~ '[a-zA-Z]' THEN 1
      ELSE 2
    END,
    "updatedAt" DESC
  ) as ids,
  COUNT(*) as total
FROM "Contacts"
WHERE "isGroup" = false
  AND "canonicalNumber" IS NOT NULL
  AND "canonicalNumber" != ''
  AND length("canonicalNumber") >= 8
GROUP BY "canonicalNumber", "companyId"
HAVING COUNT(*) > 1;

-- Ver quantidade de grupos duplicados
DO $$ 
DECLARE 
  dup_groups INTEGER;
  dup_contacts INTEGER;
BEGIN
  SELECT COUNT(*), SUM(total - 1) INTO dup_groups, dup_contacts
  FROM duplicates_to_merge;
  
  RAISE NOTICE '⚠️ Grupos de duplicados encontrados: %', dup_groups;
  RAISE NOTICE '⚠️ Contatos duplicados (serão mesclados): %', dup_contacts;
END $$;

-- ========================================
-- PASSO 3: Mesclar duplicados
-- ========================================

-- Para cada grupo, manter o primeiro (melhor) e atualizar referências dos outros
DO $$
DECLARE
  dup_record RECORD;
  master_id INTEGER;
  dup_ids INTEGER[];
  dup_id INTEGER;
BEGIN
  -- Para cada grupo de duplicados
  FOR dup_record IN SELECT * FROM duplicates_to_merge LOOP
    -- Primeiro ID é o master (melhor nome, mais recente)
    master_id := dup_record.ids[1];
    
    -- Demais IDs são duplicados
    dup_ids := dup_record.ids[2:array_length(dup_record.ids, 1)];
    
    -- Para cada duplicado
    FOREACH dup_id IN ARRAY dup_ids LOOP
      -- Atualizar referências
      UPDATE "Tickets" SET "contactId" = master_id WHERE "contactId" = dup_id;
      UPDATE "Messages" SET "contactId" = master_id WHERE "contactId" = dup_id;
      UPDATE "ContactTags" SET "contactId" = master_id WHERE "contactId" = dup_id;
      UPDATE "ContactCustomFields" SET "contactId" = master_id WHERE "contactId" = dup_id;
      UPDATE "ContactWallets" SET "contactId" = master_id WHERE "contactId" = dup_id;
      UPDATE "ContactWhatsappLabels" SET "contactId" = master_id WHERE "contactId" = dup_id;
      UPDATE "CampaignShipping" SET "contactId" = master_id WHERE "contactId" = dup_id;
      UPDATE "Schedules" SET "contactId" = master_id WHERE "contactId" = dup_id;
      UPDATE "TicketNotes" SET "contactId" = master_id WHERE "contactId" = dup_id;
      
      -- Deletar duplicado
      DELETE FROM "Contacts" WHERE id = dup_id;
      
      RAISE NOTICE '✅ Mesclado: % -> % (canonical: %)', dup_id, master_id, dup_record."canonicalNumber";
    END LOOP;
  END LOOP;
END $$;

-- ========================================
-- PASSO 4: Remover tags duplicadas
-- ========================================

DELETE FROM "ContactTags" a
USING "ContactTags" b
WHERE a.id > b.id
  AND a."contactId" = b."contactId"
  AND a."tagId" = b."tagId";

-- ========================================
-- PASSO 5: Verificação final
-- ========================================

-- Contar contatos normalizados
SELECT 
  COUNT(*) FILTER (WHERE "canonicalNumber" IS NOT NULL AND "canonicalNumber" != '') as normalizados,
  COUNT(*) FILTER (WHERE "canonicalNumber" IS NULL OR "canonicalNumber" = '') as pendentes,
  COUNT(*) as total
FROM "Contacts"
WHERE "isGroup" = false;

-- Verificar se ainda há duplicados
SELECT 
  "canonicalNumber",
  COUNT(*) as total,
  array_agg(id) as ids
FROM "Contacts"
WHERE "isGroup" = false
  AND "canonicalNumber" IS NOT NULL
  AND "canonicalNumber" != ''
GROUP BY "canonicalNumber", "companyId"
HAVING COUNT(*) > 1;

-- Se aparecer algum resultado acima, ainda há duplicados!
-- Caso contrário: ✅ SEM DUPLICADOS!

-- ========================================
-- FINALIZAR
-- ========================================

-- Se TUDO estiver OK:
COMMIT;

-- Se houver ALGUM ERRO:
-- ROLLBACK;

-- ========================================
-- RESULTADO ESPERADO
-- ========================================
-- ✅ Todos contatos normalizados
-- ✅ Todos duplicados mesclados
-- ✅ Referências atualizadas
-- ✅ Tags duplicadas removidas
