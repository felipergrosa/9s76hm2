-- Verificar status das conexões problemáticas
SELECT 
    id,
    name,
    "number",
    status,
    channelType,
    "channel",
    "createdAt",
    "updatedAt"
FROM "Whatsapps" 
WHERE id IN (16, 26)
ORDER BY id;
