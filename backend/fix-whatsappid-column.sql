-- Verificar se a coluna whatsappId existe em CampaignShipping
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'CampaignShipping'
ORDER BY ordinal_position;

-- Se a coluna NÃO aparecer acima, execute os comandos abaixo:

-- 1. Adicionar coluna whatsappId
ALTER TABLE "CampaignShipping" 
ADD COLUMN IF NOT EXISTS "whatsappId" INTEGER;

-- 2. Adicionar foreign key
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'CampaignShipping_whatsappId_fkey'
    ) THEN
        ALTER TABLE "CampaignShipping"
        ADD CONSTRAINT "CampaignShipping_whatsappId_fkey"
        FOREIGN KEY ("whatsappId") 
        REFERENCES "Whatsapps"(id)
        ON UPDATE CASCADE 
        ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Criar índice
CREATE INDEX IF NOT EXISTS "idx_campaign_shipping_whatsapp" 
ON "CampaignShipping" ("whatsappId");

-- Verificar novamente
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'CampaignShipping'
ORDER BY ordinal_position;
