-- ============================================================
-- SCRIPT DE CONSOLIDAÇÃO DE TICKETS
-- ============================================================
-- 
-- OBJETIVO: Manter apenas 1 ticket por contato (o mais recente)
-- - Migra todas as mensagens para o ticket mais recente
-- - Deleta tickets antigos que ficaram vazios
-- - Mantém consistência com a lógica de "um chat por contato"
--
-- ATENÇÃO: Faça BACKUP antes de executar!
-- Execute cada seção separadamente e valide os resultados.
-- ============================================================

-- ============================================================
-- PASSO 1: DIAGNÓSTICO - Ver situação atual
-- ============================================================

-- 1.1 Contatos com múltiplos tickets (não grupo)
SELECT 
    c.id as contact_id,
    c.name,
    c.number,
    COUNT(t.id) as total_tickets,
    MAX(t.id) as ultimo_ticket_id,
    MIN(t.id) as primeiro_ticket_id
FROM "Contacts" c
JOIN "Tickets" t ON t."contactId" = c.id
WHERE t."isGroup" = false
  AND c."companyId" = 1
GROUP BY c.id, c.name, c.number
HAVING COUNT(t.id) > 1
ORDER BY COUNT(t.id) DESC
LIMIT 20;

-- ============================================================
-- PASSO 2: Ver tickets do contato "Allan Rosa" especificamente
-- ============================================================

SELECT 
    t.id as ticket_id,
    t.status,
    t."createdAt",
    t."updatedAt",
    t."contactId",
    c.name as contact_name,
    (SELECT COUNT(*) FROM "Messages" m WHERE m."ticketId" = t.id) as total_mensagens
FROM "Tickets" t
JOIN "Contacts" c ON c.id = t."contactId"
WHERE LOWER(c.name) LIKE '%allan%rosa%'
  AND t."isGroup" = false
ORDER BY t.id DESC;

-- ============================================================
-- PASSO 3: Ver mensagens de cada ticket do Allan Rosa
-- ============================================================

SELECT 
    m.id as message_id,
    m."ticketId",
    m.body,
    m."fromMe",
    m."createdAt",
    t.status as ticket_status
FROM "Messages" m
JOIN "Tickets" t ON t.id = m."ticketId"
JOIN "Contacts" c ON c.id = t."contactId"
WHERE LOWER(c.name) LIKE '%allan%rosa%'
  AND t."isGroup" = false
ORDER BY m."createdAt" DESC
LIMIT 30;

-- ============================================================
-- PASSO 4: MIGRAÇÃO - Mover mensagens para o ticket mais recente
-- ============================================================

-- ATENÇÃO: Execute com cuidado! Faça backup antes.

-- Para cada contato com múltiplos tickets, atualizar o ticketId das mensagens
-- para apontar para o ticket mais recente (maior ID)

-- Criar tabela temporária com o mapeamento ticket_antigo -> ticket_novo
CREATE TEMP TABLE ticket_migration AS
SELECT 
    t.id as old_ticket_id,
    t."contactId",
    t."companyId",
    t."whatsappId",
    (
        SELECT MAX(t2.id) 
        FROM "Tickets" t2 
        WHERE t2."contactId" = t."contactId" 
          AND t2."companyId" = t."companyId"
          AND t2."whatsappId" = t."whatsappId"
          AND t2."isGroup" = false
    ) as new_ticket_id
FROM "Tickets" t
WHERE t."isGroup" = false
  AND t.id < (
        SELECT MAX(t2.id) 
        FROM "Tickets" t2 
        WHERE t2."contactId" = t."contactId" 
          AND t2."companyId" = t."companyId"
          AND t2."whatsappId" = t."whatsappId"
          AND t2."isGroup" = false
    );

-- Ver o que será migrado
SELECT 
    tm.old_ticket_id,
    tm.new_ticket_id,
    c.name as contact_name,
    (SELECT COUNT(*) FROM "Messages" m WHERE m."ticketId" = tm.old_ticket_id) as mensagens_a_migrar
FROM ticket_migration tm
JOIN "Contacts" c ON c.id = tm."contactId"
WHERE tm.old_ticket_id != tm.new_ticket_id
ORDER BY tm."contactId", tm.old_ticket_id;

-- ============================================================
-- PASSO 5: EXECUTAR A MIGRAÇÃO (CUIDADO!)
-- ============================================================

-- Atualizar ticketId das mensagens para o ticket mais recente
-- UPDATE "Messages" m
-- SET "ticketId" = tm.new_ticket_id
-- FROM ticket_migration tm
-- WHERE m."ticketId" = tm.old_ticket_id
--   AND tm.old_ticket_id != tm.new_ticket_id;

-- Verificar resultado
-- SELECT 
--     t.id as ticket_id,
--     c.name,
--     (SELECT COUNT(*) FROM "Messages" m WHERE m."ticketId" = t.id) as total_mensagens
-- FROM "Tickets" t
-- JOIN "Contacts" c ON c.id = t."contactId"
-- WHERE LOWER(c.name) LIKE '%allan%rosa%'
--   AND t."isGroup" = false
-- ORDER BY t.id DESC;

-- ============================================================
-- PASSO 6: LIMPEZA (OPCIONAL) - Remover tickets vazios
-- ============================================================

-- Listar tickets que ficaram sem mensagens após migração
-- SELECT t.id, t.status, c.name
-- FROM "Tickets" t
-- JOIN "Contacts" c ON c.id = t."contactId"
-- WHERE t."isGroup" = false
--   AND NOT EXISTS (SELECT 1 FROM "Messages" m WHERE m."ticketId" = t.id)
-- ORDER BY t.id;

-- Deletar tickets vazios (CUIDADO!)
-- DELETE FROM "Tickets" t
-- WHERE t."isGroup" = false
--   AND NOT EXISTS (SELECT 1 FROM "Messages" m WHERE m."ticketId" = t.id);

DROP TABLE IF EXISTS ticket_migration;
