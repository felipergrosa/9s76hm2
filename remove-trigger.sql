-- Remove trigger problemático
DROP TRIGGER IF EXISTS normalize_contact_before_save ON "Contacts";
DROP FUNCTION IF EXISTS normalize_contact_number();
