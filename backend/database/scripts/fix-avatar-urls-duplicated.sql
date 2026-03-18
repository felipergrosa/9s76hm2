-- Script para limpar avatares com URLs duplicadas no banco
-- Problema: URLs salvas como https://chatsapi.nobreluminarias.com.br/public/company1/https://pps.whatsapp.net/...
-- Solução: Remover domínio duplicado e manter apenas o caminho relativo

-- 1. Limpar profilePicUrl dos Contacts (URLs duplicadas)
UPDATE "Contacts"
SET "profilePicUrl" = NULL
WHERE "profilePicUrl" LIKE '%https://chatsapi.nobreluminarias.com.br/public/%https://%'
   OR "profilePicUrl" LIKE '%https://chatsapi.nobreluminarias.com.br/public/%http://%';

-- 2. Limpar urlPicture dos Contacts (URLs duplicadas)
UPDATE "Contacts"
SET "urlPicture" = NULL
WHERE "urlPicture" LIKE '%https://chatsapi.nobreluminarias.com.br/public/%https://%'
   OR "urlPicture" LIKE '%https://chatsapi.nobreluminarias.com.br/public/%http://%';

-- 3. Limpar profileImage dos Users (URLs duplicadas)
UPDATE "Users"
SET "profileImage" = NULL
WHERE "profileImage" LIKE '%https://chatsapi.nobreluminarias.com.br/public/%https://%'
   OR "profileImage" LIKE '%https://chatsapi.nobreluminarias.com.br/public/%http://%';

-- 4. Verificar quantos registros foram afetados
SELECT 
  'Contacts.profilePicUrl' as campo,
  COUNT(*) as total_limpos
FROM "Contacts"
WHERE "profilePicUrl" IS NULL
  AND "updatedAt" > NOW() - INTERVAL '1 minute'
UNION ALL
SELECT 
  'Contacts.urlPicture' as campo,
  COUNT(*) as total_limpos
FROM "Contacts"
WHERE "urlPicture" IS NULL
  AND "updatedAt" > NOW() - INTERVAL '1 minute'
UNION ALL
SELECT 
  'Users.profileImage' as campo,
  COUNT(*) as total_limpos
FROM "Users"
WHERE "profileImage" IS NULL
  AND "updatedAt" > NOW() - INTERVAL '1 minute';

-- OBSERVAÇÃO:
-- Após executar este script, os avatares serão baixados novamente automaticamente
-- pelo sistema quando houver nova interação com o contato/usuário.
-- O getter do modelo já está corrigido para construir URLs corretamente.
