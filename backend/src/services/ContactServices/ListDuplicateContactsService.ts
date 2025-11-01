import { Op, QueryTypes } from "sequelize";
import Contact from "../../models/Contact";
import sequelize from "../../database";

interface DuplicateRow {
  normalized: string;
  ids: number[];
  total: number | string;
}

interface TotalRow {
  total: string | number;
}

interface ListDuplicatesParams {
  companyId: number;
  limit?: number;
  offset?: number;
  canonicalNumber?: string;
}

const sanitizeDigits = (value?: string): string | null => {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits || null;
};

const ListDuplicateContactsService = async ({
  companyId,
  limit = 20,
  offset = 0,
  canonicalNumber
}: ListDuplicatesParams) => {
  const normalizedFilter = sanitizeDigits(canonicalNumber || undefined);

  const duplicates = await sequelize.query<DuplicateRow>(
    `
      WITH contact_digits AS (
        SELECT
          "id",
          "companyId",
          REGEXP_REPLACE(COALESCE("canonicalNumber", "number", ''), '\\D', '', 'g') AS digits
        FROM "Contacts"
        WHERE "companyId" = :companyId
          AND "isGroup" = false
      ),
      normalized_contacts AS (
        SELECT
          "id",
          CASE
            WHEN digits IS NULL OR digits = '' THEN NULL
            WHEN LENGTH(digits) >= 11 THEN RIGHT(digits, 11)
            WHEN LENGTH(digits) >= 8 THEN digits
            ELSE NULL
          END AS normalized
        FROM contact_digits
      )
      SELECT
        normalized,
        ARRAY_AGG(id ORDER BY id) AS ids,
        COUNT(*) AS total
      FROM normalized_contacts
      WHERE normalized IS NOT NULL
        AND normalized != ''
        ${normalizedFilter ? "AND normalized = :normalizedFilter" : ""}
      GROUP BY normalized
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT :limit
      OFFSET :offset;
    `,
    {
      replacements: {
        companyId,
        limit,
        offset,
        normalizedFilter
      },
      type: QueryTypes.SELECT
    }
  ) as unknown as DuplicateRow[];

  if (!duplicates.length) {
    return {
      groups: [],
      total: 0
    };
  }

  const allIds = duplicates.flatMap(row => row.ids);

  const contacts = await Contact.findAll({
    where: {
      companyId,
      id: { [Op.in]: allIds }
    },
    order: [["updatedAt", "DESC"]]
  });

  const contactsById = new Map<number, Contact>();
  contacts.forEach(contact => {
    contactsById.set(contact.id, contact);
  });

  const groups = duplicates.map(row => ({
    canonicalNumber: row.normalized,
    total: Number(row.total),
    contacts: row.ids
      .map(id => contactsById.get(id))
      .filter((contact): contact is Contact => Boolean(contact))
  }));

  const totalResult = await sequelize.query<TotalRow>(
    `
      WITH normalized_contacts AS (
        SELECT
          "id",
          "canonicalNumber" AS normalized
        FROM "Contacts"
        WHERE "companyId" = :companyId
          AND "isGroup" = false
          AND "canonicalNumber" IS NOT NULL
          AND "canonicalNumber" != ''
          AND LENGTH("canonicalNumber") >= 8
      )
      SELECT COUNT(*) AS total
      FROM (
        SELECT normalized
        FROM normalized_contacts
        WHERE normalized IS NOT NULL
          ${normalizedFilter ? "AND normalized = :normalizedFilter" : ""}
        GROUP BY normalized
        HAVING COUNT(*) > 1
      ) dup;
    `,
    {
      replacements: {
        companyId,
        normalizedFilter
      },
      type: QueryTypes.SELECT
    }
  ) as unknown as TotalRow[];

  const totalGroups = Number(totalResult[0]?.total ?? 0);

  return {
    groups,
    total: totalGroups
  };
};

export default ListDuplicateContactsService;
