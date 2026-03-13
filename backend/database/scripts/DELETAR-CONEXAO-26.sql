-- DELETAR CONEXÃO #26 CORROMPIDA
-- ATENÇÃO: Isso vai apagar a conexão, mas NÃO os tickets/mensagens

-- 1. Deletar conexão
DELETE FROM "Whatsapps" WHERE id = 26;

-- 2. Verificar se deletou
SELECT COUNT(*) as deleted FROM "Whatsapps" WHERE id = 26;

-- 3. Verificar tickets órfãos (se precisar reassociar depois)
SELECT id, uuid, contactId, status 
FROM "Tickets" 
WHERE whatsappId = 26 
LIMIT 5;
