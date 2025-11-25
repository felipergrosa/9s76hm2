-- DIAGNÓSTICO: Verificar histórico de mensagens do ticket 866
-- Execute este SQL para ver o que está acontecendo no banco

-- 1. Ver todas as mensagens do ticket 866
SELECT 
    id,
    ticketId,
    fromMe,
    mediaType,
    LEFT(body, 60) as body_preview,
    createdAt
FROM Messages 
WHERE ticketId = 866 
ORDER BY createdAt ASC;

-- 2. Contar mensagens por mediaType
SELECT 
    mediaType,
    COUNT(*) as total,
    SUM(CASE WHEN fromMe = 1 THEN 1 ELSE 0 END) as do_bot,
    SUM(CASE WHEN fromMe = 0 THEN 1 ELSE 0 END) as do_cliente
FROM Messages 
WHERE ticketId = 866 
GROUP BY mediaType;

-- 3. Ver últimas 10 mensagens (para debug rápido)
SELECT 
    id,
    fromMe,
    mediaType,
    body,
    createdAt
FROM Messages 
WHERE ticketId = 866 
ORDER BY createdAt DESC 
LIMIT 10;

-- 4. Ver configuração da fila do ticket 866
SELECT 
    t.id as ticket_id,
    t.status as ticket_status,
    q.id as queue_id,
    q.name as queue_name,
    q.autoSendStrategy,
    p.id as prompt_id,
    p.name as prompt_name,
    LEFT(p.prompt, 100) as prompt_preview
FROM Tickets t
LEFT JOIN Queues q ON t.queueId = q.id
LEFT JOIN Prompts p ON q.promptId = p.id
WHERE t.id = 866;

-- 5. Ver dados do contato do ticket 866
SELECT 
    c.id,
    c.name,
    c.fantasyName,
    c.contactName,
    c.city,
    c.region,
    c.segment,
    c.situation
FROM Tickets t
LEFT JOIN Contacts c ON t.contactId = c.id
WHERE t.id = 866;

-- ==========================================
-- QUERIES DE LIMPEZA (USE COM CUIDADO)
-- ==========================================

-- Para limpar histórico do ticket 866 (descomente para executar):
-- DELETE FROM Messages WHERE ticketId = 866;

-- Para fechar o ticket 866 (descomente para executar):
-- UPDATE Tickets SET status = 'closed' WHERE id = 866;
