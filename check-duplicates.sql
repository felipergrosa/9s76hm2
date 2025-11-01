SELECT id, "name", number, "canonicalNumber", "companyId"
FROM "Contacts"
WHERE "isGroup" = false
  AND "canonicalNumber" IN ('15517868419','5515517868419','551517868419')
ORDER BY "canonicalNumber", id;
