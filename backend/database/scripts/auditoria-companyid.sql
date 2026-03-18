-- Script de Auditoria: Verificar cobertura de companyId nas tabelas
-- Execute no PostgreSQL para identificar tabelas sem companyId

-- Listar todas as tabelas do schema público e verificar se têm companyId
WITH table_columns AS (
    SELECT 
        t.table_name,
        c.column_name,
        c.data_type
    FROM information_schema.tables t
    LEFT JOIN information_schema.columns c 
        ON t.table_name = c.table_name 
        AND t.table_schema = c.table_schema
    WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
),
tables_with_companyid AS (
    SELECT DISTINCT table_name 
    FROM table_columns 
    WHERE column_name = 'companyId'
),
all_tables AS (
    SELECT DISTINCT table_name
    FROM table_columns
)

SELECT 
    at.table_name,
    CASE 
        WHEN twc.table_name IS NOT NULL THEN 'SIM'
        ELSE 'NÃO'
    END AS tem_companyId,
    CASE 
        WHEN at.table_name IN (
            'SequelizeMeta',           -- Tabela interna do Sequelize
            'SequelizeMetaMigrations', -- Tabela interna do Sequelize
            'Migrations',              -- Pode ser global
            'Settings',                -- Verificar se é por empresa
            'Versions'                 -- Controle de versão
        ) THEN 'ANALISAR'
        WHEN twc.table_name IS NULL THEN 'VERIFICAR SE PRECISA'
        ELSE 'OK'
    END AS status
FROM all_tables at
LEFT JOIN tables_with_companyid twc ON at.table_name = twc.table_name
WHERE at.table_name NOT LIKE 'pg_%'
AND at.table_name NOT LIKE 'sql_%'
ORDER BY 
    CASE WHEN twc.table_name IS NULL THEN 1 ELSE 0 END,
    at.table_name;

-- Query alternativa mais detalhada:
-- Listar tabelas de relacionamento/junção que deveriam ter companyId
SELECT 
    tc.table_name,
    string_agg(tc.column_name, ', ' ORDER BY tc.column_name) AS colunas,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns c 
                     WHERE c.table_name = tc.table_name 
                     AND c.column_name = 'companyId') 
        THEN 'SIM' 
        ELSE 'NÃO' 
    END AS tem_companyId
FROM information_schema.columns tc
WHERE tc.table_schema = 'public'
AND tc.table_name IN (
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
)
GROUP BY tc.table_name
ORDER BY tc.table_name;
