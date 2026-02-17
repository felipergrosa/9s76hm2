-- Script para corrigir contato PENDING_267439107498000@lid
-- Atualiza para o número real 551999124679

-- 1. Verificar contato atual
SELECT 
    id,
    name,
    number,
    remoteJid,
    lidJid,
    whatsappId
FROM contacts 
WHERE number = 'PENDING_267439107498000@lid'
   OR lidJid = '267439107498000@lid'
   OR name LIKE '%Bruna Zanóbio Nobre Luminárias%';

-- 2. Atualizar o contato para o número real
UPDATE contacts 
SET 
    number = '551999124679',
    remoteJid = '551999124679@s.whatsapp.net',
    lidJid = '267439107498000@lid'  -- Manter o LID original para referência
WHERE id = 28652;  -- ID do contato conforme log

-- 3. Verificar se existe ticket associado e atualizar se necessário
UPDATE tickets 
SET 
    contactId = 28652
WHERE contactId IN (
    SELECT id FROM contacts 
    WHERE number = '551999124679' 
       OR number LIKE '%5519 99124-4679%'
    )
AND companyId = 1;

-- 4. Verificar resultado final
SELECT 
    c.id,
    c.name,
    c.number,
    c.remoteJid,
    c.lidJid,
    t.id as ticket_id,
    t.status,
    t.unreadMessages
FROM contacts c
LEFT JOIN tickets t ON t.contactId = c.id
WHERE c.id = 28652;
