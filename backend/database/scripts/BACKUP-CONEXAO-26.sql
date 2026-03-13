-- Backup dos dados da conexão #26 antes de deletar
SELECT 
    id, name, "number", status, channelType, 
    wabaPhoneNumberId, wabaAccessToken, wabaBusinessAccountId,
    "createdAt", "updatedAt"
FROM "Whatsapps" 
WHERE id = 26;

-- Verificar tickets associados (se precisar migrar depois)
SELECT COUNT(*) as tickets_count 
FROM "Tickets" 
WHERE whatsappId = 26;
