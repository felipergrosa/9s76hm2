-- Corrigir URLs duplicadas em urlPicture
-- Remove o domínio da URL, deixando apenas o caminho relativo

-- Verificar quantos registros estão afetados
SELECT COUNT(*) as total_afetados
FROM "Contacts"
WHERE "urlPicture" LIKE '%chatsapi.%chatsapi.%'
   OR "urlPicture" LIKE '%https//%'
   OR "urlPicture" LIKE 'https://%public/company%';

-- Corrigir URLs que contêm o domínio duplicado
UPDATE "Contacts"
SET "urlPicture" = 
  CASE
    -- Remove domínio duplicado (ex: chatsapi.nobreluminarias.com.brhttps//chatsapi.nobreluminarias.com.br/public/...)
    WHEN "urlPicture" LIKE '%chatsapi.%https//%' THEN
      REPLACE(
        REGEXP_REPLACE("urlPicture", '.*https//[^/]+(/.*)', '\1'),
        'https//', 'https://'
      )
    -- Remove domínio único (ex: https://chatsapi.nobreluminarias.com.br/public/...)
    WHEN "urlPicture" LIKE 'https://%public/company%' THEN
      REGEXP_REPLACE("urlPicture", 'https://[^/]+(/.*)', '\1')
    -- Corrige https// sem dois pontos
    WHEN "urlPicture" LIKE 'https//%' THEN
      REPLACE("urlPicture", 'https//', 'https://')
    ELSE "urlPicture"
  END
WHERE "urlPicture" LIKE '%chatsapi.%chatsapi.%'
   OR "urlPicture" LIKE '%https//%'
   OR "urlPicture" LIKE 'https://%public/company%';

-- Verificar resultado
SELECT id, number, "urlPicture"
FROM "Contacts"
WHERE "urlPicture" IS NOT NULL
  AND "urlPicture" != ''
LIMIT 20;
