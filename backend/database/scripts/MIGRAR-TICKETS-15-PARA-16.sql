-- MIGRAÇÃO MANUAL: Tickets da conexão antiga (15) → nova (16)
-- Execute no PostgreSQL

-- 1. Verificar quantos tickets existem na conexão antiga
SELECT COUNT(*) as tickets_antigos 
FROM "Tickets" 
WHERE "whatsappId" = 15 AND "companyId" = 1;

-- 2. Migrar tickets da conexão 15 para 16
UPDATE "Tickets" 
SET "whatsappId" = 16
WHERE "whatsappId" = 15 
  AND "companyId" = 1
  AND COALESCE("channel", 'whatsapp') = 'whatsapp';

-- 3. Verificar resultado
SELECT 
  'Conexão 16 (nova)' as conexao,
  COUNT(*) as total_tickets
FROM "Tickets" 
WHERE "whatsappId" = 16 AND "companyId" = 1

UNION ALL

SELECT 
  'Conexão 15 (antiga - deve estar zerado)' as conexao,
  COUNT(*) as total_tickets
FROM "Tickets" 
WHERE "whatsappId" = 15 AND "companyId" = 1;

-- 4. Verificar últimos tickets migrados
SELECT t.id, t.status, c.name as contact_name, t."updatedAt"
FROM "Tickets" t
JOIN "Contacts" c ON t."contactId" = c.id
WHERE t."whatsappId" = 16 AND t."companyId" = 1
ORDER BY t."updatedAt" DESC
LIMIT 10;
