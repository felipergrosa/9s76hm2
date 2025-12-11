import { Op } from "sequelize";
import Contact from "../../models/Contact";
import ContactWallet from "../../models/ContactWallet";
import SyncContactWalletsAndPersonalTagsService from "./SyncContactWalletsAndPersonalTagsService";
import logger from "../../utils/logger";

interface BackfillRequest {
  companyId: number;
  contactIds?: number[];
  mode?: "auto" | "wallet" | "tags";
  limit?: number;
  offset?: number;
}

interface BackfillResult {
  totalContacts: number;
  processed: number;
  bySource: {
    wallet: number;
    tags: number;
  };
  errors: Array<{
    contactId: number;
    error: string;
  }>;
}

const BackfillWalletsAndPersonalTagsService = async ({
  companyId,
  contactIds,
  mode = "auto",
  limit,
  offset
}: BackfillRequest): Promise<BackfillResult> => {
  const where: any = { companyId, isGroup: false };

  if (Array.isArray(contactIds) && contactIds.length > 0) {
    where.id = { [Op.in]: contactIds };
  }

  const queryOptions: any = {
    where,
    attributes: ["id"],
    order: [["id", "ASC"]]
  };

  if (typeof limit === "number") {
    queryOptions.limit = limit;
  }
  if (typeof offset === "number") {
    queryOptions.offset = offset;
  }

  const contacts = await Contact.findAll(queryOptions);
  const totalContacts = contacts.length;

  let processed = 0;
  const bySource = {
    wallet: 0,
    tags: 0
  };
  const errors: Array<{ contactId: number; error: string }> = [];

  for (const contact of contacts) {
    const contactId = contact.id as number;

    try {
      let source: "wallet" | "tags";

      if (mode === "wallet") {
        source = "wallet";
      } else if (mode === "tags") {
        source = "tags";
      } else {
        const walletCount = await ContactWallet.count({
          where: {
            companyId,
            contactId
          }
        });

        source = walletCount > 0 ? "wallet" : "tags";
      }

      await SyncContactWalletsAndPersonalTagsService({
        companyId,
        contactId,
        source
      });

      processed += 1;
      bySource[source] += 1;
    } catch (err: any) {
      logger.warn(
        `[BackfillWalletsAndPersonalTagsService] Falha ao sincronizar contato ${contactId}: ${err?.message || err}`
      );
      errors.push({ contactId, error: err?.message || String(err) });
    }
  }

  return {
    totalContacts,
    processed,
    bySource,
    errors
  };
};

export default BackfillWalletsAndPersonalTagsService;
