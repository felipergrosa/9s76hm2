-- ============================================================================
-- Script para corrigir contatos marcados incorretamente como grupos
-- Problema: Contatos individuais com isGroup=true mas número não termina em @g.us
-- ============================================================================

-- 1. DIAGNÓSTICO: Verificar quantos contatos estão marcados incorretamente
SELECT 
  'Contatos marcados como grupo mas SEM @g.us' as tipo,
  COUNT(*) as quantidade 
FROM "Contacts" 
WHERE "isGroup" = true 
AND "number" NOT LIKE '%@g.us';

-- 2. DIAGNÓSTICO: Ver exemplos de contatos incorretos
SELECT id, name, number, "isGroup", "whatsappId", "createdAt"
FROM "Contacts" 
WHERE "isGroup" = true 
AND "number" NOT LIKE '%@g.us'
LIMIT 20;

-- 3. CORREÇÃO: Definir isGroup=false para contatos que não são grupos reais
-- ATENÇÃO: Execute apenas após verificar o diagnóstico!
UPDATE "Contacts" 
SET "isGroup" = false 
WHERE "isGroup" = true 
AND "number" NOT LIKE '%@g.us';

-- 4. VERIFICAÇÃO: Contar grupos reais restantes
SELECT 
  'Grupos REAIS (com @g.us)' as tipo,
  COUNT(*) as quantidade 
FROM "Contacts" 
WHERE "isGroup" = true 
AND "number" LIKE '%@g.us';

-- 5. VERIFICAÇÃO: Listar grupos reais por conexão
SELECT 
  w.name as conexao,
  w.id as whatsapp_id,
  COUNT(c.id) as grupos
FROM "Contacts" c
LEFT JOIN "Whatsapps" w ON w.id = c."whatsappId"
WHERE c."isGroup" = true 
AND c."number" LIKE '%@g.us'
GROUP BY w.id, w.name
ORDER BY grupos DESC;
