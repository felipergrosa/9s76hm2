import { QueryTypes, Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import sequelize from "../../database";
import { getIO } from "../../libs/socket";
import SyncContactWalletsAndPersonalTagsService from "./SyncContactWalletsAndPersonalTagsService";

interface ProcessDuplicateByNameParams {
  companyId: number;
  normalizedName: string;
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

const referencingTables: Array<{ table: string; column: string }> = [
  { table: "Tickets", column: "contactId" },
  { table: "Messages", column: "contactId" },
  { table: "ContactTags", column: "contactId" },
  { table: "ContactCustomFields", column: "contactId" },
  { table: "ContactWallets", column: "contactId" },
  { table: "ContactWhatsappLabels", column: "contactId" },
  { table: "Schedules", column: "contactId" },
  { table: "TicketNotes", column: "contactId" },
  { table: "LogTickets", column: "contactId" }
];

const tableExistsCache = new Map<string, boolean>();

const tableExists = async (table: string, transaction?: Transaction): Promise<boolean> => {
  if (tableExistsCache.has(table)) {
    return tableExistsCache.get(table)!;
  }

  const regclassName = `public."${table}"`;
  const result = await sequelize.query<{ exists: boolean }>(
    `SELECT to_regclass(:regclassName) IS NOT NULL AS exists`,
    {
      replacements: { regclassName },
      type: QueryTypes.SELECT,
      transaction
    }
  );

  const exists = Boolean(result?.[0]?.exists);
  tableExistsCache.set(table, exists);
  return exists;
};

const filterExistingReferencingTables = async (
  transaction?: Transaction
): Promise<Array<{ table: string; column: string }>> => {
  const checks = await Promise.all(
    referencingTables.map(async ref => ({
      ref,
      exists: await tableExists(ref.table, transaction)
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

const shouldReplaceName = (currentName: string | null | undefined): boolean => {
  const normalized = (currentName || "").trim();
  return !normalized;
};

const collectUpdatesFromDuplicate = (master: Contact, duplicate: Contact) => {
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
  if (duplicateName && shouldReplaceName(master.name)) {
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
    WHERE a."id" > b."id"
      AND a."contactId" = b."contactId"
      AND a."tagId" = b."tagId";
    `,
    { transaction, type: QueryTypes.DELETE }
  );
};

const normalizeNameKey = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = String(value).trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, " ");
};

const ProcessDuplicateContactsByNameService = async ({
  companyId,
  normalizedName,
  masterId,
  targetIds = [],
  mode = "selected",
  operation = "merge"
}: ProcessDuplicateByNameParams): Promise<ProcessDuplicateResult> => {
  const normalizedKey = normalizeNameKey(normalizedName);
  if (!normalizedKey) {
    throw new AppError("ERR_INVALID_NAME_GROUP", 400);
  }

  const contactIdRows = await sequelize.query<{ id: number }>(
    `
      WITH normalized_contacts AS (
        SELECT
          "id",
          "companyId",
          TRIM(REGEXP_REPLACE(LOWER(COALESCE("name", '')), '\\s+', ' ', 'g')) AS normalized
        FROM "Contacts"
        WHERE "companyId" = :companyId
          AND "isGroup" = false
      )
      SELECT "id"
      FROM normalized_contacts
      WHERE normalized = :normalizedKey;
    `,
    {
      replacements: {
        companyId,
        normalizedKey
      },
      type: QueryTypes.SELECT
    }
  );

  if (!contactIdRows.length || contactIdRows.length < 2) {
    throw new AppError("ERR_DUPLICATE_GROUP_NOT_FOUND", 404);
  }

  const contactIds = contactIdRows.map(row => row.id);

  const contacts = await Contact.findAll({
    where: {
      companyId,
      id: contactIds
    }
  });

  if (!contacts.length || contacts.length < 2) {
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
      throw new AppError("ERR_DUPLICATE_TARGETS_REQUIRED", 400);
    }

    const uniqueTargets = Array.from(new Set(targetIds.filter(id => id !== masterId)));
    duplicates = contacts.filter(contact => uniqueTargets.includes(contact.id));

    if (!duplicates.length) {
      throw new AppError("ERR_NO_VALID_DUPLICATES_SELECTED", 400);
    }
  }

  const duplicateIds = duplicates.map(contact => contact.id);

  let updatedMaster: Contact;

  try {
    await sequelize.transaction(async transaction => {
      const existingRefs = await filterExistingReferencingTables(transaction);
      const aggregatedUpdates: Record<string, unknown> = {};

      if (operation === "merge") {
        duplicates.forEach(duplicate => {
          const updates = collectUpdatesFromDuplicate(master, duplicate);
          Object.assign(aggregatedUpdates, updates);
        });
      }

      if (Object.keys(aggregatedUpdates).length > 0) {
        await master.update(aggregatedUpdates, { transaction });
      }

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
      console.warn("[ProcessDuplicateContactsByNameService] Falha ao sincronizar carteiras e tags pessoais", err);
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
    canonicalNumber: normalizedKey
  };
};

export default ProcessDuplicateContactsByNameService;
