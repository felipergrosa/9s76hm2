SELECT id, "name", number, "canonicalNumber", "companyId"
FROM "Contacts"
WHERE "isGroup" = false
  AND id IN (
    SELECT id FROM "Contacts"
    WHERE "number" IN (
      '72546292617220',
      '8817718915232',
      '112519721037988',
      '84817047732306'
    )
      OR "canonicalNumber" IN (
      '72546292617220',
      '8817718915232',
      '112519721037988',
      '84817047732306'
    )
  );
