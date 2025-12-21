-- =====================================================
-- SCRIPT DE LIMPEZA DE CONTATOS INVÁLIDOS DE GRUPOS
-- =====================================================
-- Este script identifica e remove contatos criados incorretamente
-- a partir de mensagens de grupos, onde o número salvo é um ID
-- interno do WhatsApp ao invés do número real do participante.
--
-- PROBLEMA: Números com mais de 15 dígitos são IDs internos inválidos
-- SOLUÇÃO: Identificar e remover esses contatos
--
-- ⚠️ IMPORTANTE: Faça backup do banco antes de executar!
-- =====================================================

-- PASSO 1: Identificar contatos com números inválidos (mais de 15 dígitos)
-- Números válidos no padrão E.164 têm no máximo 15 dígitos
SELECT 
    id,
    name,
    number,
    "canonicalNumber",
    LENGTH(REGEXP_REPLACE(number, '[^0-9]', '', 'g')) as digit_count,
    "createdAt",
    "companyId"
FROM "Contacts"
WHERE 
    "isGroup" = false
    AND LENGTH(REGEXP_REPLACE(number, '[^0-9]', '', 'g')) > 15
ORDER BY "createdAt" DESC;

-- PASSO 2: Contar quantos contatos serão afetados
SELECT 
    COUNT(*) as total_invalid_contacts,
    "companyId"
FROM "Contacts"
WHERE 
    "isGroup" = false
    AND LENGTH(REGEXP_REPLACE(number, '[^0-9]', '', 'g')) > 15
GROUP BY "companyId";

-- PASSO 3: Verificar se existem tickets associados a esses contatos
-- (IMPORTANTE: Não deletar contatos com tickets ativos)
SELECT 
    c.id as contact_id,
    c.number,
    COUNT(t.id) as ticket_count,
    MAX(t."updatedAt") as last_ticket_update
FROM "Contacts" c
LEFT JOIN "Tickets" t ON t."contactId" = c.id
WHERE 
    c."isGroup" = false
    AND LENGTH(REGEXP_REPLACE(c.number, '[^0-9]', '', 'g')) > 15
GROUP BY c.id, c.number
HAVING COUNT(t.id) > 0
ORDER BY ticket_count DESC;

-- PASSO 4: BACKUP - Criar tabela temporária com contatos que serão deletados
CREATE TABLE IF NOT EXISTS "Contacts_Invalid_Backup" AS
SELECT * FROM "Contacts"
WHERE 
    "isGroup" = false
    AND LENGTH(REGEXP_REPLACE(number, '[^0-9]', '', 'g')) > 15;

-- PASSO 5: Deletar contatos inválidos SEM tickets associados
-- (Seguro - não afeta histórico de conversas)
DELETE FROM "Contacts"
WHERE 
    id IN (
        SELECT c.id
        FROM "Contacts" c
        LEFT JOIN "Tickets" t ON t."contactId" = c.id
        WHERE 
            c."isGroup" = false
            AND LENGTH(REGEXP_REPLACE(c.number, '[^0-9]', '', 'g')) > 15
        GROUP BY c.id
        HAVING COUNT(t.id) = 0
    );

-- PASSO 6: Para contatos inválidos COM tickets, marcar como inválidos
-- (Preserva histórico mas indica problema)
UPDATE "Contacts"
SET 
    name = '[INVÁLIDO] ' || name,
    situation = 'Excluido'
WHERE 
    id IN (
        SELECT c.id
        FROM "Contacts" c
        INNER JOIN "Tickets" t ON t."contactId" = c.id
        WHERE 
            c."isGroup" = false
            AND LENGTH(REGEXP_REPLACE(c.number, '[^0-9]', '', 'g')) > 15
        GROUP BY c.id
        HAVING COUNT(t.id) > 0
    )
    AND name NOT LIKE '[INVÁLIDO]%';

-- PASSO 7: Verificar resultado da limpeza
SELECT 
    'Contatos deletados' as action,
    COUNT(*) as count
FROM "Contacts_Invalid_Backup"
WHERE id NOT IN (SELECT id FROM "Contacts")
UNION ALL
SELECT 
    'Contatos marcados como inválidos' as action,
    COUNT(*) as count
FROM "Contacts"
WHERE 
    "isGroup" = false
    AND name LIKE '[INVÁLIDO]%'
    AND LENGTH(REGEXP_REPLACE(number, '[^0-9]', '', 'g')) > 15;

-- PASSO 8: Limpar tabela de backup (opcional - execute apenas se tudo estiver OK)
-- DROP TABLE IF EXISTS "Contacts_Invalid_Backup";

-- =====================================================
-- RELATÓRIO FINAL
-- =====================================================
SELECT 
    'Total de contatos' as metric,
    COUNT(*) as value
FROM "Contacts"
WHERE "isGroup" = false
UNION ALL
SELECT 
    'Contatos com números válidos (8-15 dígitos)' as metric,
    COUNT(*) as value
FROM "Contacts"
WHERE 
    "isGroup" = false
    AND LENGTH(REGEXP_REPLACE(number, '[^0-9]', '', 'g')) BETWEEN 8 AND 15
UNION ALL
SELECT 
    'Contatos com números inválidos (>15 dígitos)' as metric,
    COUNT(*) as value
FROM "Contacts"
WHERE 
    "isGroup" = false
    AND LENGTH(REGEXP_REPLACE(number, '[^0-9]', '', 'g')) > 15;

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================
