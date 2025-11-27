-- Script SQL para ver todas as pastas e seus IDs
-- Execute no pgAdmin ou psql

SELECT
    id,
    name,
    "companyId",
    "createdAt"
FROM "LibraryFolders"
WHERE
    "companyId" = 1 -- Ajuste o ID da sua empresa
ORDER BY id;

-- Ver também file lists (para comparar)
SELECT
    id,
    name,
    "companyId",
    "createdAt"
FROM "Files"
WHERE
    "companyId" = 1
ORDER BY id;