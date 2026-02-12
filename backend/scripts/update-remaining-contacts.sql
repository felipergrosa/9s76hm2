-- Script para atualizar os 16 contatos restantes com remoteJid NULL

-- Primeiro, vamos ver quais são esses contatos para debug
SELECT 
  id,
  name,
  number,
  remoteJid,
  CASE 
    WHEN LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(number, '(', ''), ')', ''), ' ', ''), '-', ''), '.', '')) < 10 THEN 'Número muito curto'
    WHEN number LIKE '%@lid%' THEN 'É um LID'
    WHEN number LIKE 'PENDING_%' THEN 'É um contato pendente'
    WHEN number LIKE '%@g.us%' THEN 'É um grupo'
    ELSE 'Número normal'
  END as tipo
FROM "Contacts"
WHERE "remoteJid" IS NULL 
  AND "number" IS NOT NULL 
  AND "companyId" = 1
ORDER BY id;

-- Agora o UPDATE para corrigir os contatos válidos
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
    '.', '')) >= 10
  AND "companyId" = 1;

-- Verificar resultado final
SELECT 
  'RESULTADO FINAL' as status,
  COUNT(*) as total_contatos,
  COUNT(CASE WHEN "remoteJid" IS NULL THEN 1 END) as remoteJid_null,
  COUNT(CASE WHEN "remoteJid" LIKE '%@s.whatsapp.net' THEN 1 END) as formato_correto
FROM "Contacts"
WHERE "companyId" = 1;
