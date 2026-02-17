-- Script para deletar contato PENDING e testar comportamento
-- Isso vai forçar o sistema a criar um novo contato com as regras corrigidas

-- 1. Fazer backup do contato antes de deletar
CREATE TABLE IF NOT EXISTS backup_bruna_pending AS
SELECT * FROM contacts 
WHERE id = 28652;

-- 2. Verificar tickets associados
SELECT 
    t.id as ticket_id,
    t.status,
    t.unreadMessages,
    t.uuid,
    c.id as contact_id,
    c.name,
    c.number
FROM tickets t
JOIN contacts c ON c.id = t.contactId
WHERE c.id = 28652;

-- 3. Deletar o contato PENDING
-- Isso vai deletar em cascata:
-- - ContactTags (associações de tags)
-- - ContactLists (listas de contato)
-- - TicketMessages (mensagens ficam órfãs mas são preservadas)
-- - LidMappings (mapeamentos LID)
DELETE FROM contacts 
WHERE id = 28652;

-- 4. Verificar se há algum contato duplicado com o número real
SELECT 
    id,
    name,
    number,
    remoteJid,
    lidJid
FROM contacts 
WHERE number = '551999124679'
   OR number LIKE '%5519 99124-4679%';

-- 5. Verificar se as mensagens foram preservadas
SELECT 
    COUNT(*) as total_mensagens,
    MIN(createdAt) as primeira_mensagem,
    MAX(createdAt) as ultima_mensagem
FROM messages 
WHERE contactId = 28652;

-- 6. Limpar registros órfãos (opcional)
-- Se quiser limpar as mensagens órfãs:
-- DELETE FROM messages WHERE contactId = 28652;

-- 7. Verificar LidMappings
SELECT *
FROM lid_mappings
WHERE lid = '267439107498000@lid';
