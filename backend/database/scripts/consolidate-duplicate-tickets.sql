-- ============================================================
-- SCRIPT: Consolidar tickets duplicados e manter histórico unificado
-- Executar após mudanças no FindOrCreateTicketService
-- ============================================================

-- PASSO 1: Verificar tickets duplicados (mesmo contato, status aberto)
-- Deve retornar 0 após correção
SELECT "contactId", COUNT(*) as ticket_count,
       array_agg(t.id ORDER BY t.id) as ticket_ids,
       array_agg(t.status ORDER BY t.id) as statuses
FROM "Tickets" t
WHERE t.status NOT IN ('closed', 'group')  -- grupos podem ter múltiplos
GROUP BY t."contactId"
HAVING COUNT(*) > 1;

-- PASSO 2: Consolidar tickets duplicados
-- Estratégia: Manter o ticket MAIS RECENTE, mover mensagens do antigo para o novo

DO $$
DECLARE
    dup_record RECORD;
    old_ticket_id INT;
    new_ticket_id INT;
BEGIN
    -- Para cada contato com múltiplos tickets abertos
    FOR dup_record IN 
        SELECT t."contactId", 
               array_agg(t.id ORDER BY t.id DESC) as ticket_ids,
               array_agg(t.status ORDER BY t.id DESC) as statuses
        FROM "Tickets" t
        WHERE t.status NOT IN ('closed', 'group')
        GROUP BY t."contactId"
        HAVING COUNT(*) > 1
    LOOP
        -- Primeiro ID é o mais recente (manter)
        new_ticket_id := dup_record.ticket_ids[1];
        
        -- Mover mensagens dos tickets antigos para o novo
        FOR old_ticket_id IN SELECT unnest(dup_record.ticket_ids[2:array_length(dup_record.ticket_ids, 1)])
        LOOP
            -- Atualizar mensagens para o novo ticket
            UPDATE "Messages" 
            SET "ticketId" = new_ticket_id 
            WHERE "ticketId" = old_ticket_id;
            
            -- Marcar ticket antigo como closed
            UPDATE "Tickets" 
            SET status = 'closed', 
                "updatedAt" = NOW() 
            WHERE id = old_ticket_id;
            
            RAISE NOTICE 'Consolidado: contato %, ticket % movido para %', 
                dup_record."contactId", old_ticket_id, new_ticket_id;
        END LOOP;
    END LOOP;
END $$;

-- PASSO 3: Verificar se ainda há duplicados
SELECT "contactId", COUNT(*) as ticket_count
FROM "Tickets"
WHERE status NOT IN ('closed', 'group')
GROUP BY "contactId"
HAVING COUNT(*) > 1;

-- PASSO 4: Verificar integridade das mensagens
SELECT COUNT(*) as total_messages, 
       COUNT(DISTINCT "ticketId") as distinct_tickets
FROM "Messages"
WHERE "ticketId" IN (
    SELECT id FROM "Tickets" WHERE status NOT IN ('closed', 'group')
);

-- PASSO 5: Limpar cache de mensagens (se existir)
-- Nota: a tabela pode não existir, ignorar erro se não houver cache
-- DELETE FROM "TicketMessageCache" WHERE 1=1;
