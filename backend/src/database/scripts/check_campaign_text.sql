-- Verificar o texto que foi salvo nas mensagens de campanha
SELECT 
  m.id,
  m.body,
  LENGTH(m.body) as body_length,
  m."mediaType",
  m."mediaUrl",
  tk.status as ticket_status,
  tk."whatsappId"
FROM "Messages" m
JOIN "Tickets" tk ON tk.id = m."ticketId"
WHERE m."fromMe" = true
  AND m."mediaType" = 'image'
  AND tk.status = 'campaign'
  AND m.body IS NOT NULL
  AND m.body != ''
LIMIT 10;
