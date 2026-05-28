-- Limpar avatares placeholder e corrompidos do banco
-- Isso permite que o RefreshContactAvatarService baixe novamente os avatares reais

-- 1. Limpar contatos onde urlPicture eh o proprio placeholder
UPDATE "Contacts"
SET "urlPicture" = NULL,
    "pictureUpdated" = false
WHERE "urlPicture" = 'nopicture.png'
   OR "urlPicture" LIKE '%nopicture%';

-- 2. Limpar profilePicUrl que seja placeholder
UPDATE "Contacts"
SET "profilePicUrl" = NULL
WHERE "profilePicUrl" LIKE '%nopicture.png%';

-- 3. Limpar urlPicture vazio
UPDATE "Contacts"
SET "urlPicture" = NULL,
    "pictureUpdated" = false
WHERE "urlPicture" = '';

-- 4. Limpar profilePicUrl vazio
UPDATE "Contacts"
SET "profilePicUrl" = NULL
WHERE "profilePicUrl" = '';
