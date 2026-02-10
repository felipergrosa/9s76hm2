-- ============================================================
-- CORREÇÃO DE TICKETS ÓRFÃOS - Conexão #31 (Bruna)
-- Executar no DBeaver, bloco por bloco
-- ============================================================

-- ============================================================
-- PASSO 1: DIAGNÓSTICO - Verificar conexão #31
-- ============================================================
SELECT id, name, status, number, "companyId", "updatedAt"
FROM "Whatsapps"
WHERE id = 31;

-- ============================================================
-- PASSO 2: DIAGNÓSTICO - Listar TODAS as conexões da empresa
-- ============================================================
SELECT id, name, status, number, "channelType"
FROM "Whatsapps"
WHERE "companyId" = 1
ORDER BY id;

-- ============================================================
-- PASSO 3: DIAGNÓSTICO - Encontrar tickets órfãos
-- (whatsappId aponta para conexão que NÃO existe mais)
-- ============================================================
SELECT 
    t."whatsappId" AS conexao_apagada,
    COUNT(*) AS total_tickets,
    COUNT(*) FILTER (WHERE t.status = 'open') AS abertos,
    COUNT(*) FILTER (WHERE t.status = 'pending') AS pendentes,
    COUNT(*) FILTER (WHERE t.status = 'closed') AS fechados,
    MIN(t."createdAt") AS primeiro_criado,
    MAX(t."updatedAt") AS ultimo_atualizado
FROM "Tickets" t
LEFT JOIN "Whatsapps" w ON t."whatsappId" = w.id
WHERE w.id IS NULL
  AND t."whatsappId" IS NOT NULL
  AND t."companyId" = 1
GROUP BY t."whatsappId"
ORDER BY total_tickets DESC;

-- ============================================================
-- PASSO 4: DIAGNÓSTICO - Ver detalhes dos tickets órfãos
-- ============================================================
SELECT 
    t.id AS ticket_id,
    t."whatsappId" AS conexao_antiga,
    t.status,
    t."lastMessage",
    t."updatedAt",
    c.name AS contato,
    c.number AS telefone
FROM "Tickets" t
LEFT JOIN "Whatsapps" w ON t."whatsappId" = w.id
LEFT JOIN "Contacts" c ON t."contactId" = c.id
WHERE w.id IS NULL
  AND t."whatsappId" IS NOT NULL
  AND t."companyId" = 1
ORDER BY t."updatedAt" DESC
LIMIT 30;

-- ============================================================
-- PASSO 5: CONTAGEM - Quantos tickets serão migrados
-- ============================================================
SELECT COUNT(*) AS tickets_a_migrar
FROM "Tickets" t
LEFT JOIN "Whatsapps" w ON t."whatsappId" = w.id
WHERE w.id IS NULL
  AND t."whatsappId" IS NOT NULL
  AND t."companyId" = 1;

-- ============================================================
-- PASSO 6: MIGRAÇÃO - Mover tickets órfãos para conexão #31
-- ⚠️  EXECUTAR SOMENTE APÓS CONFIRMAR OS PASSOS ACIMA
-- ============================================================
UPDATE "Tickets"
SET "whatsappId" = 31
WHERE "whatsappId" IN (
    SELECT t."whatsappId"
    FROM "Tickets" t
    LEFT JOIN "Whatsapps" w ON t."whatsappId" = w.id
    WHERE w.id IS NULL
      AND t."whatsappId" IS NOT NULL
      AND t."companyId" = 1
)
AND "companyId" = 1;

-- ============================================================
-- PASSO 7: VERIFICAÇÃO - Confirmar que não há mais órfãos
-- ============================================================
SELECT COUNT(*) AS orfaos_restantes
FROM "Tickets" t
LEFT JOIN "Whatsapps" w ON t."whatsappId" = w.id
WHERE w.id IS NULL
  AND t."whatsappId" IS NOT NULL
  AND t."companyId" = 1;

-- ============================================================
-- PASSO 8: VERIFICAÇÃO - Tickets agora na conexão #31
-- ============================================================
SELECT 
    COUNT(*) AS total_tickets,
    COUNT(*) FILTER (WHERE status = 'open') AS abertos,
    COUNT(*) FILTER (WHERE status = 'pending') AS pendentes,
    COUNT(*) FILTER (WHERE status = 'closed') AS fechados
FROM "Tickets"
WHERE "whatsappId" = 31 AND "companyId" = 1;
