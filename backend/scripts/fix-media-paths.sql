-- ========================================
-- SCRIPT: Corrigir caminhos de mídia antigas
-- ========================================
-- Problema: Mídias antigas estão em pastas UUID (contacts/{uuid}/)
-- mas o código novo procura em pastas por contactId (contact{id}/)
--
-- Este script NÃO move os arquivos físicos, apenas atualiza o banco
-- para apontar para as pastas corretas
-- ========================================

-- 1. ANÁLISE: Ver quantas mensagens têm mídia com formato antigo
SELECT 
  COUNT(*) as total_com_midia,
  COUNT(CASE WHEN "mediaUrl" LIKE '%-%' THEN 1 END) as formato_uuid,
  COUNT(CASE WHEN "mediaUrl" LIKE 'contact%/%' THEN 1 END) as formato_novo
FROM "Messages"
WHERE "mediaUrl" IS NOT NULL AND "mediaUrl" != '';

-- 2. Ver exemplos de URLs antigas
SELECT 
  id,
  "contactId",
  "mediaUrl",
  "mediaType",
  "createdAt"
FROM "Messages"
WHERE "mediaUrl" IS NOT NULL 
  AND "mediaUrl" LIKE '%-%'  -- UUIDs têm hífens
LIMIT 10;

-- 3. MIGRAÇÃO: Atualizar mensagens para usar o formato por contactId
-- ATENÇÃO: Execute este comando SOMENTE depois de mover os arquivos físicos
-- ou se quiser que o sistema busque nas pastas antigas (já implementado no getter)
/*
UPDATE "Messages"
SET "mediaUrl" = 'contact' || "contactId" || '/' || 
  CASE 
    WHEN "mediaUrl" LIKE '%/%' THEN substring("mediaUrl" from position('/' in "mediaUrl") + 1)
    ELSE "mediaUrl"
  END
WHERE "mediaUrl" IS NOT NULL 
  AND "mediaUrl" != ''
  AND "mediaUrl" NOT LIKE 'contact%/%';  -- Só atualiza se não estiver no formato novo
*/

-- 4. VERIFICAÇÃO: Conferir se a atualização funcionou
/*
SELECT 
  COUNT(*) as total_atualizado
FROM "Messages"
WHERE "mediaUrl" LIKE 'contact%/%';
*/
