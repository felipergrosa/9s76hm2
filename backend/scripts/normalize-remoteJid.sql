-- Script para normalizar remoteJid de contatos
-- 
-- Problema: Muitos contatos têm remoteJid = NULL mesmo com número válido
-- Solução: Preencher remoteJid com formato "numero@s.whatsapp.net"

-- 1. Atualizar contatos com remoteJid NULL e número válido
UPDATE "Contacts"
SET "remoteJid" = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    "number", 
    '(', ''), 
    ')', ''), 
    ' ', ''), 
    '-', ''), 
    '.', '') || '@s.whatsapp.net'
WHERE "remoteJid" IS NULL 
  AND "number" IS NOT NULL 
  AND "number" NOT LIKE '%@lid%'
  AND "number" NOT LIKE 'PENDING_%'
  AND "number" NOT LIKE '%@g.us%'
  AND LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    "number", 
    '(', ''), 
    ')', ''), 
    ' ', ''), 
    '-', ''), 
    '.', '')) >= 10;

-- 2. Corrigir contatos com remoteJid em formato incorreto (não termina com @s.whatsapp.net)
UPDATE "Contacts"
SET "remoteJid" = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    "number", 
    '(', ''), 
    ')', ''), 
    ' ', ''), 
    '-', ''), 
    '.', '') || '@s.whatsapp.net'
WHERE "remoteJid" IS NOT NULL 
  AND "remoteJid" NOT LIKE '%@s.whatsapp.net'
  AND "remoteJid" NOT LIKE '%@lid%'
  AND "remoteJid" NOT LIKE '%@g.us%'
  AND "number" IS NOT NULL
  AND LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    "number", 
    '(', ''), 
    ')', ''), 
    ' ', ''), 
    '-', ''), 
    '.', '')) >= 10;

-- 3. Preencher canonicalNumber se estiver NULL
UPDATE "Contacts"
SET "canonicalNumber" = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    "number", 
    '(', ''), 
    ')', ''), 
    ' ', ''), 
    '-', ''), 
    '.', '')
WHERE "canonicalNumber" IS NULL 
  AND "number" IS NOT NULL 
  AND "number" NOT LIKE '%@lid%'
  AND "number" NOT LIKE 'PENDING_%'
  AND "number" NOT LIKE '%@g.us%'
  AND LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    "number", 
    '(', ''), 
    ')', ''), 
    ' ', ''), 
    '-', ''), 
    '.', '')) >= 10;

-- 4. Relatório de quantos foram atualizados
SELECT 
  'Relatório de normalização' as status,
  COUNT(*) as total_contatos,
  COUNT(CASE WHEN "remoteJid" IS NOT NULL THEN 1 END) as com_remoteJid,
  COUNT(CASE WHEN "remoteJid" IS NULL THEN 1 END) as remoteJid_null,
  COUNT(CASE WHEN "remoteJid" LIKE '%@s.whatsapp.net' THEN 1 END) as formato_correto,
  COUNT(CASE WHEN "remoteJid" LIKE '%@lid' THEN 1 END) AS formato_lid,
  COUNT(CASE WHEN "remoteJid" IS NULL AND "number" IS NOT NULL THEN 1 END) AS precisam_atualizar
FROM "Contacts"
WHERE "companyId" = 1;  -- Altere para o companyId desejado
