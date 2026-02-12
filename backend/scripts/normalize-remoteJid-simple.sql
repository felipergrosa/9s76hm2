-- Script simples para normalizar remoteJid de contatos
-- Execute passo a passo para maior segurança

-- PASSO 1: Verificar quantos contatos precisam ser atualizados
SELECT 
  'ANTES DA ATUALIZACAO' as status,
  COUNT(*) as total_contatos,
  COUNT(CASE WHEN "remoteJid" IS NULL THEN 1 END) as remoteJid_null,
  COUNT(CASE WHEN "remoteJid" LIKE '%@s.whatsapp.net' THEN 1 END) as formato_correto
FROM "Contacts"
WHERE "companyId" = 1;

-- PASSO 2: Atualizar contatos com remoteJid NULL
-- (Descomente a linha abaixo para executar)
-- UPDATE "Contacts"
-- SET "remoteJid" = REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
--   "number", 
--   '[^0-9]', '', 'g'
-- ), '^55', '', 'g'), '^0', '', 'g'), '^(\d{2})(\d{9,13})$', '55\1\2', '') || '@s.whatsapp.net'
-- WHERE "remoteJid" IS NULL 
--   AND "number" IS NOT NULL 
--   AND "number" NOT LIKE '%@lid%'
--   AND "number" NOT LIKE 'PENDING_%'
--   AND "number" NOT LIKE '%@g.us%'
--   AND "companyId" = 1;

-- PASSO 3: Verificar resultado após atualização
SELECT 
  'APOS ATUALIZACAO' as status,
  COUNT(*) as total_contatos,
  COUNT(CASE WHEN "remoteJid" IS NULL THEN 1 END) as remoteJid_null,
  COUNT(CASE WHEN "remoteJid" LIKE '%@s.whatsapp.net' THEN 1 END) as formato_correto
FROM "Contacts"
WHERE "companyId" = 1;
