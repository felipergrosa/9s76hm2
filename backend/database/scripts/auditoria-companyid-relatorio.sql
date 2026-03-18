-- RELATÓRIO DE AUDITORIA: Cobertura de companyId nas tabelas
-- Data: 2026-03-17
-- Sistema: Whaticket

-- EXECUTAR NO POSTGRESQL PARA GERAR RELATÓRIO REAL:

WITH table_info AS (
    SELECT 
        t.table_name,
        EXISTS (
            SELECT 1 
            FROM information_schema.columns c 
            WHERE c.table_name = t.table_name 
            AND c.table_schema = 'public'
            AND c.column_name = 'companyId'
        ) AS tem_companyId,
        (
            SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
            FROM information_schema.columns c
            WHERE c.table_name = t.table_name 
            AND c.table_schema = 'public'
        ) AS colunas
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    AND t.table_name NOT LIKE 'sql_%'
    AND t.table_name NOT LIKE 'Sequelize%'
)
SELECT 
    table_name,
    CASE WHEN tem_companyId THEN 'SIM' ELSE 'NÃO' END AS tem_companyId,
    CASE 
        -- Tabelas que SEMPRE devem ter companyId (dados por empresa)
        WHEN table_name IN (
            'Contacts', 'Tickets', 'Messages', 'Users', 'Queues', 'Whatsapp',
            'Tags', 'QuickMessages', 'Campaigns', 'CampaignShippings',
            'ContactLists', 'ContactListItems', 'Schedules', 'Announcements',
            'Integrations', 'Prompts', 'Chatbots', 'FlowBuilders',
            'ContactWallets', 'ContactTags', 'ContactCustomFields',
            'TicketTags', 'TicketTrackings', 'LogTickets',
            'KnowledgeDocuments', 'KnowledgeChunks', 'LibraryFiles', 'LibraryFolders',
            'Invoices', 'CompaniesSettings', 'Settings', 'Audits',
            'ContactImportLogs', 'ContactReleaseRequests',
            'ContactTagImportPresets', 'LidMappings', 'WhatsappsLabels',
            'ContactWhatsappLabels', 'Partners', 'AIAgents', 'AIPrompts',
            'AIUsageLogs', 'AITestScenarios', 'AITestResults', 'AITrainingFeedbacks',
            'AITrainingImprovements', 'AIPromptVersions'
        ) AND NOT tem_companyId THEN 'CRÍTICO - ADICIONAR URGENTE'
        
        -- Tabelas de relacionamento que devem ter companyId
        WHEN table_name IN (
            'UserQueues', 'WhatsappQueues', 'TicketTags', 'ContactTags',
            'ContactWallets', 'ContactWhatsappLabels', 'ChatUsers', 'UserGroupPermissions'
        ) AND NOT tem_companyId THEN 'RELACIONAMENTO - ADICIONAR companyId'
        
        -- Tabelas que NÃO precisam de companyId (globais ou específicas)
        WHEN table_name IN ('Companies', 'SequelizeMeta', 'SequelizeMetaMigrations') 
        THEN 'N/A - Global'
        
        WHEN tem_companyId THEN 'OK'
        ELSE 'VERIFICAR'
    END AS prioridade
FROM table_info
ORDER BY 
    CASE 
        WHEN table_name IN (
            'Contacts', 'Tickets', 'Messages', 'Users', 'Queues', 'Whatsapp',
            'Tags', 'QuickMessages', 'Campaigns', 'CampaignShippings',
            'ContactLists', 'ContactListItems', 'Schedules', 'Announcements',
            'Integrations', 'Prompts', 'Chatbots', 'FlowBuilders',
            'ContactWallets', 'ContactTags', 'ContactCustomFields',
            'TicketTags', 'TicketTrackings', 'LogTickets',
            'KnowledgeDocuments', 'KnowledgeChunks', 'LibraryFiles', 'LibraryFolders',
            'Invoices', 'CompaniesSettings', 'Settings', 'Audits',
            'ContactImportLogs', 'ContactReleaseRequests',
            'ContactTagImportPresets', 'LidMappings', 'WhatsappsLabels',
            'ContactWhatsappLabels', 'Partners', 'AIAgents', 'AIPrompts',
            'AIUsageLogs', 'AITestScenarios', 'AITestResults', 'AITrainingFeedbacks',
            'AITrainingImprovements', 'AIPromptVersions'
        ) AND NOT tem_companyId THEN 1
        WHEN table_name IN (
            'UserQueues', 'WhatsappQueues', 'TicketTags', 'ContactTags',
            'ContactWallets', 'ContactWhatsappLabels', 'ChatUsers', 'UserGroupPermissions'
        ) AND NOT tem_companyId THEN 2
        ELSE 3
    END,
    table_name;

-- ===========================================
-- RESUMO DAS TABELAS IDENTIFICADAS SEM companyId
-- ===========================================

/*
TABELAS DE RELACIONAMENTO QUE PRECISAM DE companyId:

1. ContactTag (ContactTags) - MIGRATION CRIADA ✓
   - Já sendo corrigida

2. ContactWhatsappLabel (ContactWhatsappLabels) - PRECISA
   - Relaciona contatos com labels do WhatsApp
   - Sem companyId, uma empresa pode ver labels de outra

3. UserQueue (UserQueues) - PRECISA  
   - Relaciona usuários com filas
   - Sem companyId, pode ter conflito entre empresas

4. TicketTag (TicketTags) - PRECISA
   - Relaciona tickets com tags
   - Sem companyId, dados podem vazar entre empresas

5. WhatsappQueue (WhatsappQueues) - PRECISA
   - Relaciona conexões WhatsApp com filas
   - Sem companyId, risco de segurança

6. ChatUser (ChatUsers) - VERIFICAR
   - Relaciona chats com usuários
   - Depende se o Chat já tem companyId

7. QueueOption - VERIFICAR
   - Opções de fila
   - Já tem queueId, mas queue já tem companyId

TABELAS PRINCIPAIS JÁ COM companyId (OK):
- ContactWallets ✓
- UserGroupPermissions ✓
- Messages, Contacts, Tickets, Users, etc.

*/
