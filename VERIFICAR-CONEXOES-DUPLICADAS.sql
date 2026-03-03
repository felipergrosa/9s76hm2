-- Verificar conexões com mesmo número
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
WHERE "number" = '+5519992461008' 
   OR "number" = '5519992461008'
   OR "number" LIKE '%19992461008%'
ORDER BY id;
