-- Script para preencher canonicalNumber nos ContactListItems existentes
-- Execute após rodar a migration que adiciona a coluna

-- 1. Primeiro, adicionar a coluna se não existir (caso a migration não tenha rodado)
-- ALTER TABLE "ContactListItems" ADD COLUMN IF NOT EXISTS "canonicalNumber" VARCHAR(255);

-- 2. Atualizar registros existentes: normalizar número (remover caracteres não numéricos)
-- e adicionar código 55 se necessário
UPDATE "ContactListItems"
SET "canonicalNumber" = 
  CASE 
    -- Se já começa com 55 e tem mais de 11 dígitos, usar como está
    WHEN regexp_replace(number, '\D', '', 'g') ~ '^55' 
         AND length(regexp_replace(number, '\D', '', 'g')) > 11 
    THEN regexp_replace(number, '\D', '', 'g')
    -- Se tem 10-11 dígitos (número brasileiro sem código país), adicionar 55
    WHEN length(regexp_replace(number, '\D', '', 'g')) >= 10 
         AND length(regexp_replace(number, '\D', '', 'g')) <= 11 
    THEN '55' || regexp_replace(number, '\D', '', 'g')
    -- Caso contrário, apenas remover caracteres não numéricos
    ELSE regexp_replace(number, '\D', '', 'g')
  END
WHERE "canonicalNumber" IS NULL 
   OR "canonicalNumber" = '';

-- 3. Criar índice para melhorar performance (se não existir)
CREATE INDEX IF NOT EXISTS idx_contactlistitems_canonical_company 
ON "ContactListItems" ("canonicalNumber", "companyId");

-- 4. Verificar quantos registros foram atualizados
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN "canonicalNumber" IS NOT NULL AND "canonicalNumber" != '' THEN 1 END) as com_canonical,
  COUNT(CASE WHEN "canonicalNumber" IS NULL OR "canonicalNumber" = '' THEN 1 END) as sem_canonical
FROM "ContactListItems";

-- 5. Verificar associações com Contact (quantos têm match)
SELECT 
  COUNT(DISTINCT cli.id) as total_items,
  COUNT(DISTINCT c.id) as items_com_contact
FROM "ContactListItems" cli
LEFT JOIN "Contacts" c ON cli."canonicalNumber" = c."canonicalNumber" AND cli."companyId" = c."companyId";
