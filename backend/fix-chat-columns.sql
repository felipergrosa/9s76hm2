-- Adicionar colunas type e directKey na tabela Chats
ALTER TABLE "Chats" ADD COLUMN IF NOT EXISTS "type" VARCHAR(255) NOT NULL DEFAULT 'group';
ALTER TABLE "Chats" ADD COLUMN IF NOT EXISTS "directKey" VARCHAR(255) DEFAULT NULL;

-- Atualizar chats existentes para tipo 'group'
UPDATE "Chats" SET "type" = 'group' WHERE "type" IS NULL OR "type" = '';

-- Criar índice único para directKey
CREATE UNIQUE INDEX IF NOT EXISTS chats_company_directkey_unique ON "Chats" ("companyId", "directKey");
