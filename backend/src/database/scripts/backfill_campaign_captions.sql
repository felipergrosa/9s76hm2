-- BACKFILL DE CAMPANHA (API OFICIAL) PARA PREENCHER CAPTIONS EM MENSAGENS DE TEMPLATE
-- Uso:
--   psql -h <host> -U <user> -d <db> -f backfill_campaign_captions.sql
--
-- O QUE FAZ:
--   - Atualiza mensagens de campanha já enviadas (isCampaign = true)
--   - Para mensagens com mediaType em ('image','document','video') e body vazio/nulo
--   - Usa Campaign.metaTemplateBody como fonte do texto
--
-- IMPORTANTE:
--   - Só roda para conexões API Oficial (Campaign.whatsappId -> Whatsapp.channelType = 'official')
--   - Não duplica mensagens; apenas preenche body onde está vazio
--

-- 1) Criar tabela de apoio com corpo do template por campanha (apenas API Oficial)
DROP TABLE IF EXISTS tmp_campaign_template_body;
CREATE TEMP TABLE tmp_campaign_template_body AS
SELECT
  c.id AS campaign_id,
  COALESCE(NULLIF(TRIM(c."metaTemplateBody"), ''), NULL) AS template_body
FROM "Campaigns" c
INNER JOIN "Whatsapps" w ON w.id = c."whatsappId"
WHERE w."channelType" = 'official';

-- 2) Atualizar mensagens de campanha sem texto (body vazio/nulo) mas com mídia (image/document/video)
--    Define o body a partir do template_body da campanha
UPDATE "Messages" m
SET body = t.template_body
FROM "Tickets" tk
JOIN "CampaignShipping" cs ON cs.id = tk."campaignShippingId"
JOIN tmp_campaign_template_body t ON t.campaign_id = cs."campaignId"
WHERE m."ticketId" = tk.id
  AND m."isCampaign" = true
  AND (m.body IS NULL OR m.body = '' OR m.body = 'Template: ' || (SELECT "metaTemplateName" FROM "Campaigns" c WHERE c.id = cs."campaignId"))
  AND m."mediaType" IN ('image','document','video')
  AND t.template_body IS NOT NULL;

-- 3) Relatório rápido
SELECT
  m."mediaType",
  COUNT(*) AS total_atualizados
FROM "Messages" m
JOIN "Tickets" tk ON tk.id = m."ticketId"
JOIN "CampaignShipping" cs ON cs.id = tk."campaignShippingId"
JOIN tmp_campaign_template_body t ON t.campaign_id = cs."campaignId"
WHERE m."isCampaign" = true
  AND m.body = t.template_body
  AND m."mediaType" IN ('image','document','video')
GROUP BY m."mediaType";
