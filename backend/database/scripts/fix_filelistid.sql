-- Script para corrigir fileListId inválidos nas filas
-- Problema: Queues referenciando fileListId que não existe em Files

-- 1. Verificar quais filas têm fileListId inválido
SELECT q.id, q.name, q.fileListId
FROM "Queues" q
    LEFT JOIN "Files" f ON q.fileListId = f.id
WHERE
    q.fileListId IS NOT NULL
    AND f.id IS NULL;

-- 2. Limpar fileListId inválidos (setar como NULL)
UPDATE "Queues" q
SET
    fileListId = NULL
WHERE
    fileListId IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM "Files" f
        WHERE
            f.id = q.fileListId
    );

-- 3. Verificar se há algum registro corrigido
SELECT id, name, fileListId FROM "Queues" WHERE id IN (2);
-- ID da fila com problema