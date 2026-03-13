-- Script para forçar novo QR Code após erro 515
-- Execute no PostgreSQL antes de tentar reconectar

-- Desconectar qualquer sessão existente
UPDATE "Whatsapps" 
SET 
  status = 'PENDING',
  qrcode = '',
  "retries" = 0,
  session = ''
WHERE id = 15;

-- Limpar dados do Baileys para esta sessão
DELETE FROM "Baileys" WHERE "whatsappId" = 15;

-- Limpar mapeamentos LID antigos (opcional - pode ajudar)
DELETE FROM "LidMappings" WHERE "whatsappId" = 15;

-- Confirmar alterações
SELECT id, name, status, qrcode FROM "Whatsapps" WHERE id = 15;
