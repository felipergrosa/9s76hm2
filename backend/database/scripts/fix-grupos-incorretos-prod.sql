-- ============================================================================
-- SCRIPT DE CORREÇÃO: Contatos marcados incorretamente como grupos
-- Data: 2026-03-19
-- Ambiente: PRODUÇÃO (DBeaver)
-- ============================================================================
-- PROBLEMA: Contatos individuais estão com isGroup=true mas número não termina em @g.us
-- SOLUÇÃO: Corrigir isGroup para false nesses casos
-- ============================================================================

-- ============================================================================
-- PASSO 1: DIAGNÓSTICO (EXECUTAR PRIMEIRO - NÃO ALTERA DADOS)
-- ============================================================================

-- 1.1 Contar contatos marcados incorretamente como grupos
SELECT 
  'Contatos INCORRETOS (isGroup=true mas sem @g.us)' as diagnostico,
  COUNT(*) as quantidade 
FROM "Contacts" 
WHERE "isGroup" = true 
AND "number" NOT LIKE '%@g.us';

-- 1.2 Ver exemplos de contatos incorretos (para validar antes de corrigir)
SELECT 
  id, 
  name, 
  number, 
  "isGroup", 
  "whatsappId", 
  "companyId",
  "createdAt"
FROM "Contacts" 
WHERE "isGroup" = true 
AND "number" NOT LIKE '%@g.us'
ORDER BY "createdAt" DESC
LIMIT 30;

-- 1.3 Contar grupos REAIS (para comparar depois)
SELECT 
  'Grupos REAIS (isGroup=true E com @g.us)' as diagnostico,
  COUNT(*) as quantidade 
FROM "Contacts" 
WHERE "isGroup" = true 
AND "number" LIKE '%@g.us';

-- ============================================================================
-- PASSO 2: CORREÇÃO (EXECUTAR APÓS VALIDAR O DIAGNÓSTICO)
-- ============================================================================

-- 2.1 Corrigir: definir isGroup=false para contatos que NÃO são grupos reais
-- ATENÇÃO: Esta query ALTERA dados!
UPDATE "Contacts" 
SET "isGroup" = false, "updatedAt" = NOW()
WHERE "isGroup" = true 
AND "number" NOT LIKE '%@g.us';

-- ============================================================================
-- PASSO 3: VERIFICAÇÃO PÓS-CORREÇÃO
-- ============================================================================

-- 3.1 Verificar se ainda existem contatos incorretos (deve retornar 0)
SELECT 
  'Contatos INCORRETOS restantes (deve ser 0)' as verificacao,
  COUNT(*) as quantidade 
FROM "Contacts" 
WHERE "isGroup" = true 
AND "number" NOT LIKE '%@g.us';

-- 3.2 Contar grupos reais por conexão
SELECT 
  w.name as conexao,
  w.id as whatsapp_id,
  w.status as status_conexao,
  COUNT(c.id) as total_grupos
FROM "Contacts" c
LEFT JOIN "Whatsapps" w ON w.id = c."whatsappId"
WHERE c."isGroup" = true 
AND c."number" LIKE '%@g.us'
GROUP BY w.id, w.name, w.status
ORDER BY total_grupos DESC;

-- 3.3 Total geral de grupos reais
SELECT 
  'TOTAL de grupos REAIS após correção' as resultado,
  COUNT(*) as quantidade 
FROM "Contacts" 
WHERE "isGroup" = true 
AND "number" LIKE '%@g.us';

-- ============================================================================
-- PASSO 4: LIMPEZA OPCIONAL - Remover tickets órfãos de grupos falsos
-- ============================================================================

-- 4.1 Verificar tickets que apontam para "grupos" que agora são contatos
SELECT 
  'Tickets com isGroup=true mas contato não é mais grupo' as verificacao,
  COUNT(*) as quantidade
FROM "Tickets" t
JOIN "Contacts" c ON c.id = t."contactId"
WHERE t."isGroup" = true
AND c."isGroup" = false;

-- 4.2 Corrigir tickets (opcional - descomente se necessário)
-- UPDATE "Tickets" t
-- SET "isGroup" = false, "updatedAt" = NOW()
-- FROM "Contacts" c
-- WHERE c.id = t."contactId"
-- AND t."isGroup" = true
-- AND c."isGroup" = false;

