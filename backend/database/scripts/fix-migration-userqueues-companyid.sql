-- ============================================
-- FIX EMERGENCY: Migration 20260317000002-add-companyid-to-userqueues
-- ============================================
-- Execute este script no banco de produção para corrigir a migration travada

-- 1. Verificar se há registros sem companyId
SELECT COUNT(*) as total_null
FROM "UserQueues" 
WHERE "companyId" IS NULL;

-- 2. Preencher companyId baseado no usuário (SE houver registros nulos)
UPDATE "UserQueues" uq
SET "companyId" = u."companyId"
FROM "Users" u
WHERE uq."userId" = u.id
AND uq."companyId" IS NULL;

-- 3. Verificar se ainda há nulos (usuários sem companyId vinculada)
SELECT uq.id, uq."userId", u.name as user_name
FROM "UserQueues" uq
LEFT JOIN "Users" u ON uq."userId" = u.id
WHERE uq."companyId" IS NULL;

-- 4. Se ainda houver nulos, atribuir companyId=1 como fallback (ajuste conforme necessário)
-- UPDATE "UserQueues" 
-- SET "companyId" = 1 
-- WHERE "companyId" IS NULL;

-- 5. Tornar a coluna NOT NULL (após garantir que não há mais nulos)
ALTER TABLE "UserQueues" ALTER COLUMN "companyId" SET NOT NULL;

-- 6. Criar índice se não existir
CREATE INDEX IF NOT EXISTS "user_queues_company_id" ON "UserQueues"("companyId");

-- 7. Registrar a migration como executada manualmente
-- (opcional: apenas se quiser pular a migration no Sequelize)
-- INSERT INTO "SequelizeMeta" (name) VALUES ('20260317000002-add-companyid-to-userqueues.js');
