-- VERIFICAÇÃO PÓS-MIGRAÇÃO
-- Verificar situação atual das conexões e tickets

-- 1. Status das conexões
SELECT 
  id,
  name,
  number,
  status,
  "createdAt"
FROM "Whatsapps"
WHERE id IN (15, 16) AND "companyId" = 1
ORDER BY id;

-- 2. Tickets por conexão
SELECT 
  w.id as whatsapp_id,
  w.name as conexao,
  w.status,
  COUNT(t.id) as tickets_count,
  MAX(t."updatedAt") as ultimo_ticket
FROM "Whatsapps" w
LEFT JOIN "Tickets" t ON w.id = t."whatsappId"
WHERE w.id IN (15, 16) AND w."companyId" = 1
GROUP BY w.id, w.name, w.status
ORDER BY w.id;

-- 3. Contatos com o número alvo
SELECT 
  id,
  name,
  number,
  "createdAt"
FROM "Contacts"
WHERE number LIKE '%5519992461008%'
  AND "companyId" = 1
ORDER BY id;

-- 4. Tickets com contatos do número alvo
SELECT 
  t.id as ticket_id,
  t.status,
  t."whatsappId",
  c.name as contato_nome,
  c.number as contato_numero,
  t."createdAt"
FROM "Tickets" t
JOIN "Contacts" c ON t."contactId" = c.id
WHERE c.number LIKE '%5519992461008%'
  AND t."companyId" = 1
ORDER BY t."updatedAt" DESC
LIMIT 10;

-- 5. Log de migração (se tabela foi criada)
SELECT 
  "migrationType",
  "fromWhatsappId",
  "toWhatsappId",
  "phoneNumber",
  "ticketsMigrated",
  "contactsMerged",
  "createdAt"
FROM "MigrationLogs"
WHERE "phoneNumber" = '5519992461008'
ORDER BY "createdAt" DESC
LIMIT 5;
