-- Verificar configuração atual do plano
SELECT 
    c.id as company_id,
    c.name as company_name,
    p.id as plan_id,
    p.name as plan_name,
    p."useCampaigns",
    p."useKanban",
    p."useOpenAi",
    p."useIntegrations",
    p."useSchedules",
    p."useInternalChat",
    p."useExternalApi"
FROM "Companies" c
INNER JOIN "Plans" p ON c."planId" = p.id
WHERE c.id = 1;

-- Se useCampaigns estiver false, rode este UPDATE:
-- UPDATE "Plans" SET "useCampaigns" = true WHERE id = (SELECT "planId" FROM "Companies" WHERE id = 1);
