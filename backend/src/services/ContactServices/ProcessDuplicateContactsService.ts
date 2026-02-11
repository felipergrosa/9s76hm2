import { QueryTypes, Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import sequelize from "../../database";
import { getIO } from "../../libs/socket";
import { safeNormalizePhoneNumber } from "../../utils/phone";
import SyncContactWalletsAndPersonalTagsService from "./SyncContactWalletsAndPersonalTagsService";

interface ProcessDuplicateParams {
  companyId: number;
  canonicalNumber: string;
  masterId: number;
  targetIds?: number[];
  mode?: "selected" | "all";
  operation?: "merge" | "delete";
}

interface ProcessDuplicateResult {
  master: Contact;
  mergedIds: number[];
  operation: "merge" | "delete";
  canonicalNumber: string;
}

// Tabelas que referenciam Contacts via contactId
// NOTA: LogTickets NÃO tem contactId (só ticketId), então foi removido da lista
const referencingTables: Array<{ table: string; column: string }> = [
  { table: "Tickets", column: "contactId" },
  { table: "Messages", column: "contactId" },
  { table: "ContactTags", column: "contactId" },
  { table: "ContactCustomFields", column: "contactId" },
  { table: "ContactWallets", column: "contactId" },
  { table: "ContactWhatsappLabels", column: "contactId" },
  { table: "Schedules", column: "contactId" },
  { table: "TicketNotes", column: "contactId" }
];

const tableColumnExistsCache = new Map<string, boolean>();

const tableAndColumnExist = async (
  table: string,
  column: string,
  transaction?: Transaction
): Promise<boolean> => {
  const cacheKey = `${table}.${column}`;
  if (tableColumnExistsCache.has(cacheKey)) {
    return tableColumnExistsCache.get(cacheKey)!;
  }

  // Verifica se a tabela E a coluna existem
  const result = await sequelize.query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = :table
        AND column_name = :column
    ) AS exists
    `,
    {
      replacements: { table, column },
      type: QueryTypes.SELECT,
      transaction
    }
  );

  const exists = Boolean(result?.[0]?.exists);
  tableColumnExistsCache.set(cacheKey, exists);
  return exists;
};

const filterExistingReferencingTables = async (
  transaction?: Transaction
): Promise<Array<{ table: string; column: string }>> => {
  const checks = await Promise.all(
    referencingTables.map(async ref => ({
      ref,
      exists: await tableAndColumnExist(ref.table, ref.column, transaction)
    }))
  );

  return checks.filter(item => item.exists).map(item => item.ref);
};

const mergeStringFields = [
  "email",
  "representativeCode",
  "city",
  "region",
  "instagram",
  "fantasyName",
  "creditLimit",
  "segment",
  "contactName",
  "bzEmpresa",
  "cpfCnpj"
];

const mergeDirectFields = ["foundationDate", "dtUltCompra", "vlUltCompra", "situation"] as const;

const shouldReplaceName = (currentName: string | null | undefined, fallbackNumber: string): boolean => {
  const normalized = (currentName || "").trim();
  if (!normalized) return true;

  const digitsOnly = normalized.replace(/\D/g, "");
  return digitsOnly === fallbackNumber;
};

const collectUpdatesFromDuplicate = (master: Contact, duplicate: Contact, canonicalNumber: string) => {
  const updates: Record<string, unknown> = {};

  mergeStringFields.forEach(field => {
    const incoming = (duplicate as any)[field];
    if (incoming === undefined || incoming === null) return;

    const normalizedIncoming = typeof incoming === "string" ? incoming.trim() : incoming;
    if (normalizedIncoming === "" || normalizedIncoming === null) return;

    const current = (master as any)[field];
    if (!current || (typeof current === "string" && current.trim() === "")) {
      updates[field] = incoming;
    }
  });

  mergeDirectFields.forEach(field => {
    const incoming = (duplicate as any)[field];
    if (incoming === undefined || incoming === null) return;
    const current = (master as any)[field];
    if (current === undefined || current === null) {
      updates[field] = incoming;
    }
  });

  const duplicateName = duplicate.name;
  if (duplicateName && shouldReplaceName(master.name, canonicalNumber)) {
    updates.name = duplicateName;
  }

  return updates;
};

const updateReferences = async (
  masterId: number,
  duplicateId: number,
  refs: Array<{ table: string; column: string }>,
  transaction: Transaction
): Promise<void> => {
  for (const ref of refs) {
    if (ref.table === "ContactTags") {
      await sequelize.query(
        `
          DELETE FROM "ContactTags"
          WHERE "contactId" = :duplicateId
            AND EXISTS (
              SELECT 1
              FROM "ContactTags" ct
              WHERE ct."contactId" = :masterId
                AND ct."tagId" = "ContactTags"."tagId"
            );
        `,
        {
          replacements: { masterId, duplicateId },
          transaction,
          type: QueryTypes.DELETE
        }
      );
    }

    if (ref.table === "ContactWallets") {
      await sequelize.query(
        `
          DELETE FROM "ContactWallets"
          WHERE "contactId" = :duplicateId
            AND EXISTS (
              SELECT 1
              FROM "ContactWallets" cw
              WHERE cw."contactId" = :masterId
                AND cw."walletId" = "ContactWallets"."walletId"
            );
        `,
        {
          replacements: { masterId, duplicateId },
          transaction,
          type: QueryTypes.DELETE
        }
      );
    }

    if (ref.table === "ContactWhatsappLabels") {
      await sequelize.query(
        `
          DELETE FROM "ContactWhatsappLabels"
          WHERE "contactId" = :duplicateId
            AND EXISTS (
              SELECT 1
              FROM "ContactWhatsappLabels" cwl
              WHERE cwl."contactId" = :masterId
                AND cwl."labelId" = "ContactWhatsappLabels"."labelId"
            );
        `,
        {
          replacements: { masterId, duplicateId },
          transaction,
          type: QueryTypes.DELETE
        }
      );
    }

    await sequelize.query(
      `UPDATE "${ref.table}" SET "${ref.column}" = :masterId WHERE "${ref.column}" = :duplicateId`,
      {
        replacements: { masterId, duplicateId },
        transaction,
        type: QueryTypes.UPDATE
      }
    );
  }
};

const dedupeContactTags = async (transaction: Transaction): Promise<void> => {
  await sequelize.query(
    `
    DELETE FROM "ContactTags" a
    USING "ContactTags" b
    WHERE a.ctid > b.ctid
      AND a."contactId" = b."contactId"
      AND a."tagId" = b."tagId";
    `,
    { transaction, type: QueryTypes.DELETE }
  );
};

const normalizeGroupKey = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const digitsOnly = String(value).replace(/\D/g, "");
  if (!digitsOnly) return null;
  if (digitsOnly.length >= 11) {
    return digitsOnly.slice(-11);
  }
  if (digitsOnly.length >= 8) {
    return digitsOnly;
  }
  return null;
};

const ProcessDuplicateContactsService = async ({
  companyId,
  canonicalNumber,
  masterId,
  targetIds = [],
  mode = "selected",
  operation = "merge"
}: ProcessDuplicateParams): Promise<ProcessDuplicateResult> => {
  const normalizedGroupKey = normalizeGroupKey(canonicalNumber);

  if (!normalizedGroupKey) {
    throw new AppError("ERR_INVALID_CANONICAL_NUMBER");
  }

  const contactIdRows = await sequelize.query<{ id: number }>(
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
      SELECT "id"
      FROM normalized_contacts
      WHERE normalized = :normalizedKey;
    `,
    {
      replacements: {
        companyId,
        normalizedKey: normalizedGroupKey
      },
      type: QueryTypes.SELECT
    }
  );

  if (!contactIdRows.length) {
    throw new AppError("ERR_DUPLICATE_GROUP_NOT_FOUND", 404);
  }

  const contactIds = contactIdRows.map(row => row.id);

  const contacts = await Contact.findAll({
    where: {
      companyId,
      id: contactIds
    }
  });

  if (!contacts.length) {
    throw new AppError("ERR_DUPLICATE_GROUP_NOT_FOUND", 404);
  }

  const master = contacts.find(contact => contact.id === masterId);
  if (!master) {
    throw new AppError("ERR_MASTER_CONTACT_NOT_FOUND", 404);
  }

  let duplicates: Contact[];
  if (mode === "all") {
    duplicates = contacts.filter(contact => contact.id !== masterId);
  } else {
    if (!targetIds.length) {
      throw new AppError("ERR_DUPLICATE_TARGETS_REQUIRED");
    }

    const uniqueTargets = Array.from(new Set(targetIds.filter(id => id !== masterId)));
    duplicates = contacts.filter(contact => uniqueTargets.includes(contact.id));

    if (!duplicates.length) {
      throw new AppError("ERR_NO_VALID_DUPLICATES_SELECTED");
    }
  }

  const duplicateIds = duplicates.map(contact => contact.id);

  let updatedMaster: Contact;

  const canonicalCandidates = contacts
    .map(contact => safeNormalizePhoneNumber(contact.canonicalNumber || contact.number)?.canonical)
    .filter((value): value is string => Boolean(value));

  const finalCanonical = canonicalCandidates[0]
    || safeNormalizePhoneNumber(normalizedGroupKey)?.canonical
    || normalizedGroupKey;

  try {
    await sequelize.transaction(async transaction => {
      const existingRefs = await filterExistingReferencingTables(transaction);
      const aggregatedUpdates: Record<string, unknown> = {};

      if (operation === "merge") {
        duplicates.forEach(duplicate => {
          const updates = collectUpdatesFromDuplicate(master, duplicate, finalCanonical);
          Object.assign(aggregatedUpdates, updates);
        });
      }

      if (master.number !== finalCanonical) {
        aggregatedUpdates.number = finalCanonical;
      }

      if (master.canonicalNumber !== finalCanonical) {
        aggregatedUpdates.canonicalNumber = finalCanonical;
      }

      // PASSO 1: Renomear o `number` dos duplicados para evitar UniqueConstraintError
      // O campo `number` é @Unique, então precisamos liberar os valores antes do update do master
      for (const duplicate of duplicates) {
        const tempNumber = `__dup_${duplicate.id}_${Date.now()}`;
        await sequelize.query(
          'UPDATE "Contacts" SET "number" = :tempNumber WHERE "id" = :duplicateId',
          {
            replacements: { tempNumber, duplicateId: duplicate.id },
            transaction,
            type: QueryTypes.UPDATE
          }
        );
      }

      // PASSO 2: Atualizar o master com os campos mesclados
      if (Object.keys(aggregatedUpdates).length > 0) {
        await master.update(aggregatedUpdates, { transaction });
      }

      // PASSO 3: Mover referências e destruir duplicados
      for (const duplicate of duplicates) {
        await updateReferences(master.id, duplicate.id, existingRefs, transaction);

        await sequelize.query(
          'DELETE FROM "ContactCustomFields" WHERE "contactId" = :duplicateId',
          {
            replacements: { duplicateId: duplicate.id },
            transaction,
            type: QueryTypes.DELETE
          }
        );

        await duplicate.destroy({ transaction, force: true });
      }

      await dedupeContactTags(transaction);

      await master.reload({ transaction });
      updatedMaster = master;
    });
  } catch (err: any) {
    throw new AppError(`ERR_PROCESS_DUPLICATES_FAILED: ${err?.message || err}`, 500);
  }

  if (updatedMaster) {
    try {
      await SyncContactWalletsAndPersonalTagsService({
        companyId,
        contactId: updatedMaster.id,
        source: "tags"
      });
    } catch (err) {
      console.warn("[ProcessDuplicateContactsService] Falha ao sincronizar carteiras e tags pessoais", err);
    }
  }

  let io: any;
  try {
    io = getIO();
  } catch (err) {
    io = null;
  }

  if (io) {
    if (updatedMaster) {
      io.of(`/workspace-${companyId}`)
        .emit(`company-${companyId}-contact`, {
          action: "update",
          contact: updatedMaster
        });
    }

    duplicateIds.forEach(id => {
      io.of(`/workspace-${companyId}`)
        .emit(`company-${companyId}-contact`, {
          action: "delete",
          contactId: id
        });
    });
  }

  return {
    master: updatedMaster,
    mergedIds: duplicateIds,
    operation,
    canonicalNumber: finalCanonical
  };
};

export default ProcessDuplicateContactsService;
