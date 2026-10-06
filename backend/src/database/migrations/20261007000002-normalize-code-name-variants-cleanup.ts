import { QueryInterface } from "sequelize";

/**
 * Migration: limpa variantes "código - nome" órfãs em
 * representativeCode/segment/bzEmpresa
 *
 * Dois reparos:
 * 1) Remove sufixo " - " pendente ("0001 - " → "0001") — nasce quando o
 *    JOIN do ERP não encontra a descrição do representante/segmento.
 * 2) Re-colapsa variantes do mesmo código: para cada (companyId, código)
 *    o canônico é a variante com " - " do contato atualizado mais
 *    recentemente; os demais valores convergem para ele.
 *
 * Idempotente: o UPDATE só toca linhas diferentes do canônico.
 */

const stripTrailingDashSql = (column: string) => `
UPDATE "Contacts"
SET "${column}" = regexp_replace("${column}", '\\s*-\\s*$', '')
WHERE "companyId" IS NOT NULL
  AND "${column}" ~ '\\s*-\\s*$';
`;

const collapseSql = (column: string) => `
WITH canon AS (
  SELECT DISTINCT ON ("companyId", code)
         "companyId", code, "${column}" AS canonical
  FROM (
    SELECT "companyId",
           substring("${column}" from '^\\s*(\\d+)') AS code,
           "${column}",
           "updatedAt"
    FROM "Contacts"
    WHERE "${column}" ~ '^\\s*\\d+'
      AND "companyId" IS NOT NULL
  ) s
  ORDER BY "companyId", code,
           (CASE WHEN "${column}" LIKE '% - %' THEN 0 ELSE 1 END),
           "updatedAt" DESC
)
UPDATE "Contacts" c
SET "${column}" = canon.canonical
FROM canon
WHERE c."companyId" = canon."companyId"
  AND substring(c."${column}" from '^\\s*(\\d+)') = canon.code
  AND c."${column}" IS DISTINCT FROM canon.canonical;
`;

const COLUMNS = ["representativeCode", "segment", "bzEmpresa"];

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    for (const column of COLUMNS) {
      await queryInterface.sequelize.query(stripTrailingDashSql(column));
      await queryInterface.sequelize.query(collapseSql(column));
    }
  },

  // down: irreversível por natureza (colapsa variantes de dados).
  down: async () => {}
};
