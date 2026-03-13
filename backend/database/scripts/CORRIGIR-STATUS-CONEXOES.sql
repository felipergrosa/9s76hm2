-- Atualizar status para refleir realidade (conexões desconectadas)
UPDATE "Whatsapps" 
SET status = 'DISCONNECTED' 
WHERE id IN (16, 26) 
  AND status = 'CONNECTED';

-- Verificar resultado
SELECT id, name, "number", status, channelType 
FROM "Whatsapps" 
WHERE id IN (16, 26);
