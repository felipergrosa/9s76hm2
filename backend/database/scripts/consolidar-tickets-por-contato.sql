-- ============================================================
-- SCRIPT DE CONSOLIDAÇÃO DE TICKETS POR CONTATO + CONEXÃO
-- ============================================================
-- 
-- OBJETIVO: Manter apenas 1 ticket por CONTATO + CONEXÃO (whatsappId)
-- 
-- REGRA: Um contato pode ter múltiplos chats se estiver em conexões diferentes
-- Exemplo:
--   - Allan Rosa + Conexão #31 → 1 ticket consolidado
--   - Allan Rosa + Conexão #32 → 1 ticket consolidado (separado)
--
-- O que o script faz:
-- - Agrupa tickets por: contactId + companyId + whatsappId
-- - Mantém o ticket mais recente (maior ID) de cada grupo
-- - Migra mensagens dos tickets antigos para o mais recente
-- - Deleta tickets antigos
--
-- ATENÇÃO: 
-- 1. Faça BACKUP antes de executar!
-- 2. Execute em ambiente de TESTE primeiro
-- 3. Execute cada seção separadamente e valide os resultados
-- ============================================================

-- ============================================================
-- PASSO 1: DIAGNÓSTICO - Ver situação atual
-- ============================================================

-- 1.1 Total de grupos (contato + conexão) com múltiplos tickets
SELECT 
    COUNT(*) as grupos_com_multiplos_tickets,
    SUM(ticket_count - 1) as tickets_a_remover
FROM (
    SELECT 
        t."contactId",
        t."whatsappId",
        COUNT(t.id) as ticket_count
    FROM "Tickets" t
    WHERE t."isGroup" = false
    GROUP BY t."contactId", t."whatsappId"
    HAVING COUNT(t.id) > 1
) sub;

-- 1.2 Detalhes por CONTATO + CONEXÃO (top 30)
-- Cada linha = um grupo que será consolidado em 1 ticket
SELECT 
    c.id as contact_id,
    c.name as contact_name,
    t."whatsappId" as conexao_id,
    w.name as conexao_nome,
    COUNT(t.id) as total_tickets,
    MAX(t.id) as ticket_a_manter,
    ARRAY_AGG(t.id ORDER BY t.id) as todos_tickets,
    SUM((SELECT COUNT(*) FROM "Messages" m WHERE m."ticketId" = t.id)) as total_mensagens
FROM "Contacts" c
JOIN "Tickets" t ON t."contactId" = c.id
LEFT JOIN "Whatsapps" w ON w.id = t."whatsappId"
WHERE t."isGroup" = false
GROUP BY c.id, c.name, t."whatsappId", w.name
HAVING COUNT(t.id) > 1
ORDER BY COUNT(t.id) DESC
LIMIT 30;

-- ============================================================
-- PASSO 2: CRIAR TABELA DE MAPEAMENTO
-- ============================================================
-- Agrupa por: contactId + companyId + whatsappId
-- Cada grupo terá apenas 1 ticket (o mais recente)

-- Criar tabela temporária com mapeamento ticket_antigo -> ticket_novo
DROP TABLE IF EXISTS ticket_consolidation;

CREATE TEMP TABLE ticket_consolidation AS
SELECT 
    t.id as old_ticket_id,
    t."contactId",
    t."companyId",
    t."whatsappId",
    t.status as old_status,
    (
        SELECT MAX(t2.id) 
        FROM "Tickets" t2 
        WHERE t2."contactId" = t."contactId" 
          AND t2."companyId" = t."companyId"
          AND COALESCE(t2."whatsappId", 0) = COALESCE(t."whatsappId", 0)
          AND t2."isGroup" = false
    ) as new_ticket_id,
    (SELECT COUNT(*) FROM "Messages" m WHERE m."ticketId" = t.id) as message_count
FROM "Tickets" t
WHERE t."isGroup" = false
  AND t.id < (
        SELECT MAX(t2.id) 
        FROM "Tickets" t2 
        WHERE t2."contactId" = t."contactId" 
          AND t2."companyId" = t."companyId"
          AND COALESCE(t2."whatsappId", 0) = COALESCE(t."whatsappId", 0)
          AND t2."isGroup" = false
    );

-- 2.1 Ver resumo do que será consolidado
SELECT 
    COUNT(*) as tickets_a_consolidar,
    SUM(message_count) as mensagens_a_migrar
FROM ticket_consolidation
WHERE old_ticket_id != new_ticket_id;

-- 2.2 Ver detalhes (primeiros 50)
SELECT 
    tc.old_ticket_id,
    tc.new_ticket_id,
    tc.old_status,
    tc.message_count,
    c.name as contact_name
FROM ticket_consolidation tc
JOIN "Contacts" c ON c.id = tc."contactId"
WHERE tc.old_ticket_id != tc.new_ticket_id
ORDER BY tc."contactId", tc.old_ticket_id
LIMIT 50;

-- ============================================================
-- PASSO 3: MIGRAR MENSAGENS (EXECUTAR!)
-- ============================================================

-- Migrar todas as mensagens dos tickets antigos para o ticket mais recente
UPDATE "Messages" m
SET "ticketId" = tc.new_ticket_id
FROM ticket_consolidation tc
WHERE m."ticketId" = tc.old_ticket_id
  AND tc.old_ticket_id != tc.new_ticket_id;

-- Verificar quantas mensagens foram migradas
SELECT 
    tc.new_ticket_id,
    c.name,
    (SELECT COUNT(*) FROM "Messages" m WHERE m."ticketId" = tc.new_ticket_id) as total_mensagens_apos_migracao
FROM ticket_consolidation tc
JOIN "Contacts" c ON c.id = tc."contactId"
WHERE tc.old_ticket_id != tc.new_ticket_id
GROUP BY tc.new_ticket_id, c.name
ORDER BY total_mensagens_apos_migracao DESC
LIMIT 20;

-- ============================================================
-- PASSO 4: MIGRAR OUTRAS REFERÊNCIAS
-- ============================================================

-- 4.1 Migrar TicketTraking (se existir)
UPDATE "TicketTraking" tt
SET "ticketId" = tc.new_ticket_id
FROM ticket_consolidation tc
WHERE tt."ticketId" = tc.old_ticket_id
  AND tc.old_ticket_id != tc.new_ticket_id;

-- 4.2 Migrar LogTickets (se existir)
UPDATE "LogTickets" lt
SET "ticketId" = tc.new_ticket_id
FROM ticket_consolidation tc
WHERE lt."ticketId" = tc.old_ticket_id
  AND tc.old_ticket_id != tc.new_ticket_id;

-- 4.3 Migrar TicketNotes (se existir)
UPDATE "TicketNotes" tn
SET "ticketId" = tc.new_ticket_id
FROM ticket_consolidation tc
WHERE tn."ticketId" = tc.old_ticket_id
  AND tc.old_ticket_id != tc.new_ticket_id;

-- ============================================================
-- PASSO 5: DELETAR TICKETS ANTIGOS
-- ============================================================

-- 5.1 Ver tickets que serão deletados
SELECT 
    tc.old_ticket_id,
    tc.old_status,
    c.name as contact_name,
    (SELECT COUNT(*) FROM "Messages" m WHERE m."ticketId" = tc.old_ticket_id) as mensagens_restantes
FROM ticket_consolidation tc
JOIN "Contacts" c ON c.id = tc."contactId"
WHERE tc.old_ticket_id != tc.new_ticket_id
ORDER BY tc.old_ticket_id;

-- 5.2 Deletar tickets antigos (agora vazios)
DELETE FROM "Tickets" t
WHERE t.id IN (
    SELECT tc.old_ticket_id 
    FROM ticket_consolidation tc 
    WHERE tc.old_ticket_id != tc.new_ticket_id
);

-- ============================================================
-- PASSO 6: VALIDAÇÃO FINAL
-- ============================================================

-- 6.1 Verificar que não há mais contatos com múltiplos tickets
SELECT 
    c.id as contact_id,
    c.name,
    COUNT(t.id) as total_tickets
FROM "Contacts" c
JOIN "Tickets" t ON t."contactId" = c.id
WHERE t."isGroup" = false
GROUP BY c.id, c.name
HAVING COUNT(t.id) > 1
LIMIT 10;

-- 6.2 Verificar integridade - mensagens órfãs (não deveria ter)
SELECT COUNT(*) as mensagens_orfas
FROM "Messages" m
WHERE NOT EXISTS (SELECT 1 FROM "Tickets" t WHERE t.id = m."ticketId");

-- 6.3 Resumo final
SELECT 
    'Tickets restantes (não grupo)' as metrica,
    COUNT(*) as valor
FROM "Tickets" t
WHERE t."isGroup" = false
UNION ALL
SELECT 
    'Mensagens totais' as metrica,
    COUNT(*) as valor
FROM "Messages" m
UNION ALL
SELECT 
    'Contatos com tickets' as metrica,
    COUNT(DISTINCT "contactId") as valor
FROM "Tickets" t
WHERE t."isGroup" = false;

-- Limpar tabela temporária
DROP TABLE IF EXISTS ticket_consolidation;

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
