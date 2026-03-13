-- Forçar novo QR Code para sessão ID=15
-- Execute no seu cliente PostgreSQL

-- 1. Verificar status atual
SELECT id, name, status, qrcode, number FROM "Whatsapps" WHERE id = 15;

-- 2. Forçar status PENDING (permite novo QR Code)
UPDATE "Whatsapps" 
SET 
  status = 'PENDING',
  qrcode = '',
  "retries" = 0
WHERE id = 15;

-- 3. Limpar dados de sessão do Baileys
DELETE FROM "BaileysKeys" WHERE "whatsappId" = 15;
DELETE FROM "BaileysChats" WHERE "whatsappId" = 15;
DELETE FROM "BaileysContacts" WHERE "whatsappId" = 15;

-- 4. Verificar resultado
SELECT id, name, status, qrcode FROM "Whatsapps" WHERE id = 15;
