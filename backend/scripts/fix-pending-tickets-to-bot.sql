-- =====================================================
-- SCRIPT: Corrigir Tickets Pendentes para Bot
-- =====================================================
-- Este script atualiza tickets antigos que estão "pending"
-- sem fila para status "bot" se a conexão agora tem
-- fila padrão com Prompt configurado
-- =====================================================

-- PASSO 1: Verificar tickets que serão atualizados
-- =====================================================
SELECT 
  t.id as ticket_id,
  t.status as status_atual,
  t."queueId" as fila_atual,
  t."isBot" as isBot_atual,
  w.name as conexao,
  c.name as contato,
  (
    SELECT q.name 
    FROM "WhatsappQueues" wq
    JOIN "Queues" q ON q.id = wq."queueId"
    WHERE wq."whatsappId" = t."whatsappId"
    ORDER BY q."orderQueue" ASC
    LIMIT 1
  ) as fila_padrao,
  (
    SELECT COUNT(*) 
    FROM "WhatsappQueues" wq2
    JOIN "Queues" q2 ON q2.id = wq2."queueId"
    JOIN "Prompts" p ON p."queueId" = q2.id
    WHERE wq2."whatsappId" = t."whatsappId"
    LIMIT 1
  ) as tem_prompt
FROM "Tickets" t
JOIN "Whatsapps" w ON w.id = t."whatsappId"
JOIN "Contacts" c ON c.id = t."contactId"
WHERE t.status = 'pending'
  AND (t."queueId" IS NULL OR t."queueId" = 0)
  AND t."companyId" = 1
ORDER BY t.id DESC;

-- =====================================================
-- PASSO 2: Atualizar tickets para bot
-- =====================================================
-- ATENÇÃO: Descomente a query abaixo para executar!
-- =====================================================

/*
UPDATE "Tickets" t
SET 
  status = 'bot',
  "isBot" = true,
  "queueId" = (
    SELECT q.id 
    FROM "WhatsappQueues" wq
    JOIN "Queues" q ON q.id = wq."queueId"
    WHERE wq."whatsappId" = t."whatsappId"
    ORDER BY q."orderQueue" ASC
    LIMIT 1
  ),
  "updatedAt" = NOW()
WHERE t.status = 'pending'
  AND (t."queueId" IS NULL OR t."queueId" = 0)
  AND t."companyId" = 1
  AND EXISTS (
    -- Só atualizar se fila padrão tem prompt OU chatbot
    SELECT 1
    FROM "WhatsappQueues" wq2
    JOIN "Queues" q2 ON q2.id = wq2."queueId"
    WHERE wq2."whatsappId" = t."whatsappId"
      AND (
        EXISTS (SELECT 1 FROM "Prompts" p WHERE p."queueId" = q2.id)
        OR
        EXISTS (SELECT 1 FROM "Chatbots" cb WHERE cb."queueId" = q2.id)
      )
    ORDER BY q2."orderQueue" ASC
    LIMIT 1
  );
*/

-- =====================================================
-- PASSO 3: Verificar tickets atualizados
-- =====================================================
SELECT 
  t.id as ticket_id,
  t.status as status_novo,
  t."queueId" as fila_nova,
  t."isBot" as isBot_novo,
  q.name as nome_fila,
  w.name as conexao,
  c.name as contato,
  t."updatedAt" as atualizado_em
FROM "Tickets" t
JOIN "Whatsapps" w ON w.id = t."whatsappId"
JOIN "Contacts" c ON c.id = t."contactId"
LEFT JOIN "Queues" q ON q.id = t."queueId"
WHERE t.status = 'bot'
  AND t."updatedAt" > NOW() - INTERVAL '5 minutes'
  AND t."companyId" = 1
ORDER BY t."updatedAt" DESC;

-- =====================================================
-- INFORMAÇÕES ADICIONAIS
-- =====================================================

-- Contar tickets por status
SELECT 
  status,
  "isBot",
  COUNT(*) as total
FROM "Tickets"
WHERE "companyId" = 1
GROUP BY status, "isBot"
ORDER BY status;

-- Ver filas com prompts
SELECT 
  q.id as fila_id,
  q.name as fila_nome,
  COUNT(DISTINCT p.id) as total_prompts,
  COUNT(DISTINCT cb.id) as total_chatbots
FROM "Queues" q
LEFT JOIN "Prompts" p ON p."queueId" = q.id
LEFT JOIN "Chatbots" cb ON cb."queueId" = q.id
WHERE q."companyId" = 1
GROUP BY q.id, q.name
ORDER BY q.id;
