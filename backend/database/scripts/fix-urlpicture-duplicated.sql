-- Script para corrigir URLs duplicadas no campo urlPicture
-- Problema: URLs estão sendo salvas como "https://dominio.comhttps//dominio.com/..."
-- Causa: Concatenação dupla do domínio

-- 1. Verificar quantos registros estão afetados
SELECT COUNT(*) as total_afetados
FROM "Contacts"
WHERE "urlPicture" LIKE '%http%http%'
   OR "urlPicture" LIKE '%https//%'
   OR "urlPicture" LIKE '%.com.brhttps%';

-- 2. Listar exemplos dos registros afetados
SELECT id, name, "urlPicture"
FROM "Contacts"
WHERE "urlPicture" LIKE '%http%http%'
   OR "urlPicture" LIKE '%https//%'
   OR "urlPicture" LIKE '%.com.brhttps%'
LIMIT 10;

-- 3. Corrigir URLs duplicadas - extrair apenas o caminho relativo
-- Padrão esperado: contacts/uuid/avatar.jpg ou uuid.jpeg
UPDATE "Contacts"
SET "urlPicture" = 
  CASE 
    -- Se contém /public/company, extrair a partir de contacts/
    WHEN "urlPicture" LIKE '%/public/company%/contacts/%' THEN
      SUBSTRING("urlPicture" FROM '/contacts/[^?]+')
    -- Se contém /public/company mas não contacts/, extrair o filename
    WHEN "urlPicture" LIKE '%/public/company%' THEN
      REGEXP_REPLACE("urlPicture", '^.*/public/company\d+/', '')
    -- Fallback: manter como está
    ELSE "urlPicture"
  END
WHERE "urlPicture" LIKE '%http%http%'
   OR "urlPicture" LIKE '%https//%'
   OR "urlPicture" LIKE '%.com.brhttps%';

-- 4. Verificar se a correção funcionou
SELECT COUNT(*) as ainda_afetados
FROM "Contacts"
WHERE "urlPicture" LIKE '%http%http%'
   OR "urlPicture" LIKE '%https//%'
   OR "urlPicture" LIKE '%.com.brhttps%';

-- 5. Corrigir URLs que começam com http (devem ser relativas)
-- Extrair apenas o caminho relativo
UPDATE "Contacts"
SET "urlPicture" = 
  CASE
    WHEN "urlPicture" LIKE '%/contacts/%' THEN
      'contacts/' || SUBSTRING("urlPicture" FROM '/contacts/(.+?)(\?|$)')
    WHEN "urlPicture" ~ '^\d+\.jpeg$' THEN
      "urlPicture" -- Já está no formato correto (legacy)
    WHEN "urlPicture" LIKE 'contacts/%' THEN
      "urlPicture" -- Já está no formato correto
    ELSE
      NULL -- Limpar URLs inválidas
  END
WHERE "urlPicture" LIKE 'http%'
  AND "urlPicture" NOT LIKE '%/contacts/%';
