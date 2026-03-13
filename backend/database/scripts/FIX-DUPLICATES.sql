-- =====================================================
-- Script de Correção de Contatos Duplicados
-- =====================================================
-- Este script normaliza números e remove duplicados
-- de forma segura mantendo o registro mais completo
--
-- IMPORTANTE: Fazer backup antes de executar!
-- pg_dump -U postgres -d whaticket > backup_$(date +%Y%m%d).sql
-- =====================================================

-- 1. Criar função de normalização de números (se não existir)
CREATE OR REPLACE FUNCTION normalize_phone_number(phone_text TEXT)
RETURNS TEXT AS $$
DECLARE
  digits TEXT;
  result TEXT;
BEGIN
  -- Remove tudo exceto dígitos
  digits := regexp_replace(phone_text, '\D', '', 'g');
  
  -- Remove zeros à esquerda
  digits := ltrim(digits, '0');
  
  IF digits IS NULL OR digits = '' THEN
    RETURN NULL;
  END IF;
  
  -- Se não tem DDI (55) e tem 10-11 dígitos, assume Brasil
  IF length(digits) BETWEEN 10 AND 11 AND NOT (digits ~ '^(1|54|55)') THEN
    digits := '55' || digits;
  END IF;
  
  -- Se é Brasil (55) com 10 dígitos nacionais, pode precisar do 9
  IF substring(digits FROM 1 FOR 2) = '55' THEN
    DECLARE
      ddd TEXT;
      resto TEXT;
    BEGIN
      ddd := substring(digits FROM 3 FOR 2);
      resto := substring(digits FROM 5);
      
      -- Se tem 8 dígitos e começa com 6-9, é celular sem o 9
      IF length(resto) = 8 AND substring(resto FROM 1 FOR 1) ~ '[6-9]' THEN
        result := '55' || ddd || '9' || resto;
      ELSE
        result := digits;
      END IF;
    END;
  ELSE
    result := digits;
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Atualizar canonicalNumber para contatos sem normalização
UPDATE "Contacts"
SET "canonicalNumber" = normalize_phone_number(number)
WHERE "canonicalNumber" IS NULL
  AND "isGroup" = false
  AND number IS NOT NULL
  AND number != '';

-- 3. Identificar duplicados (exibir apenas)
SELECT 
  "canonicalNumber",
  "companyId",
  COUNT(*) as total,
  array_agg(id ORDER BY 
    -- Prioriza contatos com mais informações
    CASE WHEN "isWhatsappValid" = true THEN 0 ELSE 1 END,
    CASE WHEN "urlPicture" IS NOT NULL AND "urlPicture" != '' THEN 0 ELSE 1 END,
    CASE WHEN "name" != number THEN 0 ELSE 1 END,
    "createdAt" ASC
  ) as contact_ids
FROM "Contacts"
WHERE "canonicalNumber" IS NOT NULL
  AND "isGroup" = false
GROUP BY "canonicalNumber", "companyId"
HAVING COUNT(*) > 1
ORDER BY total DESC
LIMIT 50;

-- 4. Resolver duplicados automaticamente (mantém o melhor, deleta outros)
-- ATENÇÃO: Revise os duplicados acima antes de executar esta parte!
-- Descomente as linhas abaixo após revisar:

/*
WITH duplicates AS (
  SELECT 
    "canonicalNumber",
    "companyId",
    array_agg(id ORDER BY 
      CASE WHEN "isWhatsappValid" = true THEN 0 ELSE 1 END,
      CASE WHEN "urlPicture" IS NOT NULL AND "urlPicture" != '' THEN 0 ELSE 1 END,
      CASE WHEN "name" != number THEN 0 ELSE 1 END,
      "createdAt" ASC
    ) as contact_ids
  FROM "Contacts"
  WHERE "canonicalNumber" IS NOT NULL
    AND "isGroup" = false
  GROUP BY "canonicalNumber", "companyId"
  HAVING COUNT(*) > 1
),
to_delete AS (
  SELECT 
    unnest(contact_ids[2:array_length(contact_ids, 1)]) as id_to_delete
  FROM duplicates
)
-- Transferir tickets para o contato principal antes de deletar
UPDATE "Tickets" t
SET "contactId" = (
  SELECT contact_ids[1]
  FROM duplicates d
  WHERE d.contact_ids && ARRAY[t."contactId"]
)
WHERE "contactId" IN (SELECT id_to_delete FROM to_delete);

-- Transferir mensagens para o contato principal
UPDATE "Messages" m
SET "contactId" = (
  SELECT contact_ids[1]
  FROM duplicates d
  WHERE d.contact_ids && ARRAY[m."contactId"]
)
WHERE "contactId" IN (SELECT id_to_delete FROM to_delete);

-- Deletar contatos duplicados
DELETE FROM "Contacts"
WHERE id IN (SELECT id_to_delete FROM to_delete);
*/

-- 5. Verificar se ainda há duplicados
SELECT 
  "canonicalNumber",
  "companyId",
  COUNT(*) as total
FROM "Contacts"
WHERE "canonicalNumber" IS NOT NULL
  AND "isGroup" = false
GROUP BY "canonicalNumber", "companyId"
HAVING COUNT(*) > 1
ORDER BY total DESC;

-- 6. Estatísticas finais
SELECT 
  'Total de contatos' as metric,
  COUNT(*) as value
FROM "Contacts"
WHERE "isGroup" = false
UNION ALL
SELECT 
  'Contatos normalizados',
  COUNT(*)
FROM "Contacts"
WHERE "isGroup" = false 
  AND "canonicalNumber" IS NOT NULL
UNION ALL
SELECT 
  'Contatos sem normalização',
  COUNT(*)
FROM "Contacts"
WHERE "isGroup" = false 
  AND "canonicalNumber" IS NULL;

-- =====================================================
-- Como executar este script:
-- =====================================================
-- 
-- 1. Conectar ao banco:
--    docker exec -it postgres psql -U postgres -d whaticket
-- 
-- 2. Fazer backup:
--    docker exec postgres pg_dump -U postgres whaticket > backup_contatos_$(date +%Y%m%d).sql
-- 
-- 3. Executar o script (até o passo 3 primeiro):
--    docker exec -i postgres psql -U postgres -d whaticket < FIX-DUPLICATES.sql
-- 
-- 4. Revisar os duplicados encontrados
-- 
-- 5. Se estiver tudo certo, descomentar o passo 4 e executar novamente
-- 
-- =====================================================
