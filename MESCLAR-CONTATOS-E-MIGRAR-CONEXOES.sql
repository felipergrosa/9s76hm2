-- SCRIPT COMPLETO: Mesclar contatos e transferir tickets da conexão antiga (15) para nova (16)
-- Número alvo: +5519992461008

-- 1. ANALISAR SITUAÇÃO ATUAL
-- Verificar contatos duplicados com o mesmo número
WITH contatos_duplicados AS (
  SELECT 
    number,
    COUNT(*) as total,
    STRING_AGG(CAST(id AS VARCHAR), ', ') as ids
  FROM "Contacts"
  WHERE number LIKE '%5519992461008%'
    AND "companyId" = 1
  GROUP BY number
  HAVING COUNT(*) > 1
)
SELECT * FROM contatos_duplicados;

-- Verificar tickets por conexão
SELECT 
  w.id as whatsapp_id,
  w.name as conexao,
  COUNT(t.id) as tickets_count
FROM "Whatsapps" w
LEFT JOIN "Tickets" t ON w.id = t."whatsappId"
WHERE w.id IN (15, 16) AND w."companyId" = 1
GROUP BY w.id, w.name
ORDER BY w.id;

-- 2. MESCLAR CONTATOS DUPLICADOS
-- Encontrar o contato principal (o mais antigo/mais completo)
WITH contato_principal AS (
  SELECT 
    c.id,
    c.number,
    c.name,
    c."createdAt",
    ROW_NUMBER() OVER (
      PARTITION BY c.number 
      ORDER BY 
        CASE WHEN c.name IS NOT NULL AND TRIM(c.name) != '' THEN 1 ELSE 2 END,
        c."createdAt" ASC
    ) as rn
  FROM "Contacts" c
  WHERE c.number LIKE '%5519992461008%'
    AND c."companyId" = 1
),
contatos_para_mesclar AS (
  SELECT 
    cp.id as contato_principal_id,
    c.id as contato_secundario_id,
    c.number
  FROM contato_principal cp
  JOIN "Contacts" c ON cp.number = c.number AND cp.id != c.id
  WHERE cp.rn = 1
)
-- Atualizar tickets para apontar para o contato principal
UPDATE "Tickets" t
SET "contactId" = cm.contato_principal_id
FROM contatos_para_mesclar cm
WHERE t."contactId" = cm.contato_secundario_id
  AND t."companyId" = 1;

-- 3. TRANSFERIR TICKETS DA CONEXÃO ANTIGA (15) PARA NOVA (16)
-- Primeiro, verificar se existe conexão com o número alvo
SELECT id, name, number, status 
FROM "Whatsapps"
WHERE number LIKE '%5519992461008%'
  AND "companyId" = 1
  AND id IN (15, 16);

-- Transferir todos os tickets da conexão 15 para 16
UPDATE "Tickets"
SET "whatsappId" = 16
WHERE "whatsappId" = 15
  AND "companyId" = 1
  AND COALESCE("channel", 'whatsapp') = 'whatsapp';

-- 4. TRANSFERIR MENSAGENS (se a tabela Messages tiver whatsappId)
DO $$
BEGIN
  -- Verificar se a coluna existe antes de tentar atualizar
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Messages' 
      AND column_name = 'whatsappId'
      AND table_schema = 'public'
  ) THEN
    UPDATE "Messages"
    SET "whatsappId" = 16
    WHERE "whatsappId" = 15
      AND "companyId" = 1;
  END IF;
END $$;

-- 5. LIMPEZA: Remover contatos duplicados que não têm mais tickets
WITH contatos_sem_tickets AS (
  SELECT c.id
  FROM "Contacts" c
  LEFT JOIN "Tickets" t ON c.id = t."contactId"
  WHERE c.number LIKE '%5519992461008%'
    AND c."companyId" = 1
    AND t.id IS NULL
)
DELETE FROM "Contacts"
WHERE id IN (SELECT id FROM contatos_sem_tickets);

-- 6. VERIFICAÇÃO FINAL
-- Resultado da migração
SELECT 
  'Tickets na conexão 16 (nova)' as descricao,
  COUNT(*) as total
FROM "Tickets"
WHERE "whatsappId" = 16 AND "companyId" = 1

UNION ALL

SELECT 
  'Tickets na conexão 15 (antiga - deve ser 0)' as descricao,
  COUNT(*) as total
FROM "Tickets"
WHERE "whatsappId" = 15 AND "companyId" = 1

UNION ALL

SELECT 
  'Contatos únicos com o número' as descricao,
  COUNT(DISTINCT id) as total
FROM "Contacts"
WHERE number LIKE '%5519992461008%'
  AND "companyId" = 1;

-- Últimos 10 tickets na conexão nova
SELECT 
  t.id,
  t.status,
  c.name as contato_nome,
  c.number as contato_numero,
  t."createdAt",
  t."updatedAt"
FROM "Tickets" t
JOIN "Contacts" c ON t."contactId" = c.id
WHERE t."whatsappId" = 16 
  AND t."companyId" = 1
  AND c.number LIKE '%5519992461008%'
ORDER BY t."updatedAt" DESC
LIMIT 10;

-- 7. ATUALIZAR STATUS DAS CONEXÕES (opcional)
-- Desativar conexão antiga se ainda estiver ativa
UPDATE "Whatsapps"
SET status = 'DISCONNECTED',
    session = '',
    qrcode = ''
WHERE id = 15 AND "companyId" = 1;

-- Atualizar número na conexão nova se estiver vazio
UPDATE "Whatsapps"
SET number = '5519992461008'
WHERE id = 16 
  AND "companyId" = 1
  AND (number IS NULL OR number = '' OR number = '-');

-- 8. LOG DA MIGRAÇÃO (opcional - criar tabela de log se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'MigrationLogs' 
      AND table_schema = 'public'
  ) THEN
    CREATE TABLE "MigrationLogs" (
      id SERIAL PRIMARY KEY,
      "migrationType" VARCHAR(100),
      "fromWhatsappId" INTEGER,
      "toWhatsappId" INTEGER,
      "phoneNumber" VARCHAR(50),
      "ticketsMigrated" INTEGER,
      "contactsMerged" INTEGER,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
  END IF;
END $$;

-- Registrar log da migração
INSERT INTO "MigrationLogs" (
  "migrationType",
  "fromWhatsappId", 
  "toWhatsappId",
  "phoneNumber",
  "ticketsMigrated",
  "contactsMerged"
)
SELECT 
  'CONNECTION_MERGE',
  15,
  16,
  '5519992461008',
  COUNT(t.id),
  COUNT(DISTINCT t."contactId")
FROM "Tickets" t
WHERE t."whatsappId" = 16 
  AND t."companyId" = 1
  AND EXISTS (
    SELECT 1 FROM "Contacts" c 
    WHERE c.id = t."contactId" 
      AND c.number LIKE '%5519992461008%'
  );

-- Mensagem final
SELECT 
  '✅ Migração concluída com sucesso!' as status,
  'Verifique os resultados acima' as observacao;
