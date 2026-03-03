-- Script SQL para limpar sessão WhatsApp ID=13 após migração Baileys v7
-- Execute este script no seu cliente PostgreSQL (pgAdmin, DBeaver, etc.)

-- 1. Atualizar status da conexão
UPDATE "Whatsapps" 
SET 
  status = 'PENDING',
  qrcode = '',
  "retries" = 0,
  session = '',
  number = ''
WHERE id = 13;

-- 2. Limpar dados Baileys
DELETE FROM "BaileysKeys" WHERE "whatsappId" = 13;
DELETE FROM "BaileysChats" WHERE "whatsappId" = 13;
DELETE FROM "BaileysContacts" WHERE "whatsappId" = 13;

-- 3. Verificar resultado
SELECT id, name, status, number FROM "Whatsapps" WHERE id = 13;
