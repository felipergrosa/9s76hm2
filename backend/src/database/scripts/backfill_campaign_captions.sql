-- BACKFILL DE CAMPANHA (API OFICIAL) PARA PREENCHER CAPTIONS EM MENSAGENS DE TEMPLATE
-- Uso:
--   psql -h <host> -U <user> -d <db> -f backfill_campaign_captions.sql
--
-- O QUE FAZ:
--   - Atualiza mensagens de campanha já enviadas (isCampaign = true)
--   - Para mensagens com mediaType em ('image','document','video') e body vazio/nulo
--   - Usa texto da campanha (message1..message5) concatenado como fonte do caption
--
-- IMPORTANTE:
--   - Só roda para conexões API Oficial (Campaign.whatsappId -> Whatsapp.channelType = 'official')
--   - Não duplica mensagens; apenas preenche body onde está vazio
--

-- 1) Identificar campanhas API Oficial e seu texto
DROP TABLE IF EXISTS tmp_campaign_text;
CREATE TEMP TABLE tmp_campaign_text AS
SELECT
  c.id AS campaign_id,
  c."whatsappId",
  NULLIF(TRIM(CONCAT_WS(
    E'\n',
    NULLIF(TRIM(c.message1), ''),
    NULLIF(TRIM(c.message2), ''),
    NULLIF(TRIM(c.message3), ''),
    NULLIF(TRIM(c.message4), ''),
    NULLIF(TRIM(c.message5), '')
  )), '') AS campaign_text
FROM "Campaigns" c
INNER JOIN "Whatsapps" w ON w.id = c."whatsappId"
WHERE w."channelType" = 'official'
  AND c."metaTemplateName" IS NOT NULL;

-- 2) Atualizar mensagens de campanha sem texto mas com mídia
--    Identifica por: ticket com status='campaign' + fromMe=true + mediaType
--    Usa o texto da campanha (message1..5 concatenado)
UPDATE "Messages" m
SET body = t.campaign_text
FROM "Tickets" tk
JOIN tmp_campaign_text t ON t."whatsappId" = tk."whatsappId"
WHERE m."ticketId" = tk.id
  AND m."fromMe" = true
  AND (m.body IS NULL OR m.body = '' OR m.body LIKE 'Template:%')
  AND m."mediaType" IN ('image','document','video')
  AND t.campaign_text IS NOT NULL
  AND tk.status = 'campaign';

-- 3) Relatório: quantas mensagens foram atualizadas
SELECT
  m."mediaType",
  COUNT(*) AS total_atualizados,
  COUNT(DISTINCT tk."whatsappId") AS conexoes_afetadas
FROM "Messages" m
JOIN "Tickets" tk ON tk.id = m."ticketId"
JOIN tmp_campaign_text t ON t."whatsappId" = tk."whatsappId"
WHERE m."fromMe" = true
  AND m.body = t.campaign_text
  AND m."mediaType" IN ('image','document','video')
  AND tk.status = 'campaign'
GROUP BY m."mediaType";

-- 4) Verificar se ainda há mensagens sem texto em tickets de campanha
SELECT
  COUNT(*) AS mensagens_ainda_sem_texto
FROM "Messages" m
JOIN "Tickets" tk ON tk.id = m."ticketId"
WHERE m."fromMe" = true
  AND (m.body IS NULL OR m.body = '' OR m.body LIKE 'Template:%')
  AND m."mediaType" IN ('image','document','video')
  AND tk.status = 'campaign';
