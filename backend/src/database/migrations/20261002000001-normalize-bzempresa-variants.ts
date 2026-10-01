import { QueryInterface } from "sequelize";

/**
 * Migration: normaliza variantes "código nome" em bzEmpresa
 *
 * Mesmo problema de representativeCode/segment (migration 20261001000001):
 * o campo guarda "código nome" vindo do ERP (ex.: "00 LUMINARIAS (25)").
 * Quando a filial/empresa é renomeada no ERP, o sync grava a variante nova
 * e a antiga permanece em outros contatos → opções duplicadas nos
 * autocompletes e filtros fragmentados.
 *
 * Para cada (companyId, código) escolhe o valor canônico: variante com
 * " - " do contato atualizado mais recentemente; senão a mais recente.
 * Todos os contatos com variantes do mesmo código passam ao canônico.
 * A propagação em runtime (PropagateCodeNameVariantService) mantém a
 * convergência para renomeações futuras.
 */

const buildSql = (column: string) => `
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

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(buildSql("bzEmpresa"));
  },

  // down: irreversível por natureza (colapsa variantes de dados).
  // Não há como reconstruir qual variante cada contato tinha.
  down: async () => {}
};
