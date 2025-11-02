-- Script para habilitar campanhas no plano da empresa 1

-- 1. Verificar configuração atual
SELECT 
    c.id as company_id,
    c.name as company_name,
    p.id as plan_id,
    p.name as plan_name,
    p."useCampaigns" as campanhas_habilitadas
FROM "Companies" c
INNER JOIN "Plans" p ON c."planId" = p.id
WHERE c.id = 1;

-- 2. Habilitar campanhas (se estiver desabilitado)
UPDATE "Plans" 
SET "useCampaigns" = true 
WHERE id = (SELECT "planId" FROM "Companies" WHERE id = 1);

-- 3. Verificar se foi aplicado
SELECT 
    c.id as company_id,
    c.name as company_name,
    p.id as plan_id,
    p.name as plan_name,
    p."useCampaigns" as campanhas_habilitadas
FROM "Companies" c
INNER JOIN "Plans" p ON c."planId" = p.id
WHERE c.id = 1;
