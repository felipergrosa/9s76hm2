import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import sequelize from "../../database";
import { safeNormalizePhoneNumber } from "../../utils/phone";
import { getIO } from "../../libs/socket";
import ContactTag from "../../models/ContactTag";
import Tag from "../../models/Tag";
import SyncContactWalletsAndPersonalTagsService from "./SyncContactWalletsAndPersonalTagsService";

interface ProcessNormalizationParams {
  companyId: number;
  contactIds: number[];
  action: "normalize" | "tag" | "normalize_and_tag";
  canonicalNumber?: string;
  tagId?: number;
  tagName?: string;
  tagColor?: string;
}

interface ProcessNormalizationResult {
  updatedContacts: Contact[];
  action: "normalize" | "tag" | "normalize_and_tag";
  canonicalNumber?: string;
  tagId?: number;
  tagName?: string;
}

const getOrCreateTag = async (
  companyId: number,
  tagId?: number,
  tagName?: string,
  tagColor = "#FFB020",
  transaction?: Transaction
): Promise<Tag> => {
  if (tagId) {
    const existing = await Tag.findOne({ where: { id: tagId, companyId }, transaction });
    if (!existing) {
      throw new AppError("ERR_TAG_NOT_FOUND", 404);
    }
    return existing;
  }

  if (!tagName) {
    throw new AppError("ERR_TAG_DATA_REQUIRED");
  }

  const [tag] = await Tag.findOrCreate({
    where: { name: tagName, companyId },
    defaults: { color: tagColor, kanban: 0 },
    transaction
  });

  return tag;
};

const applyTagToContacts = async (
  contactIds: number[],
  tag: Tag,
  transaction: Transaction
): Promise<void> => {
  for (const contactId of contactIds) {
    await ContactTag.findOrCreate({
      where: { contactId, tagId: tag.id },
      defaults: { contactId, tagId: tag.id },
      transaction
    });
  }
};

const ProcessContactsNormalizationService = async ({
  companyId,
  contactIds,
  action,
  canonicalNumber,
  tagId,
  tagName,
  tagColor
}: ProcessNormalizationParams): Promise<ProcessNormalizationResult> => {
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    throw new AppError("ERR_CONTACT_IDS_REQUIRED");
  }

  const contacts = await Contact.findAll({
    where: { companyId, id: contactIds, isGroup: false }
  });

  if (!contacts.length) {
    throw new AppError("ERR_CONTACTS_NOT_FOUND", 404);
  }

  let io: any;
  try {
    io = getIO();
  } catch (err) {
    io = null;
  }

  let resultingTag: Tag | undefined;

  await sequelize.transaction(async transaction => {
    if (action === "normalize" || action === "normalize_and_tag") {
      let finalCanonical = canonicalNumber;

      if (!finalCanonical) {
        if (contacts.length === 1) {
          const { canonical } = safeNormalizePhoneNumber(contacts[0].number);
          if (!canonical) {
            throw new AppError("ERR_INVALID_CANONICAL_NUMBER");
          }
          finalCanonical = canonical;
        } else {
          throw new AppError("ERR_CANONICAL_REQUIRED");
        }
      }

      const normalized = safeNormalizePhoneNumber(finalCanonical);
      if (!normalized.canonical) {
        throw new AppError("ERR_INVALID_CANONICAL_NUMBER");
      }

      for (const contact of contacts) {
        await contact.update(
          {
            number: normalized.canonical,
            canonicalNumber: normalized.canonical
          },
          { transaction }
        );
      }

      canonicalNumber = normalized.canonical;
    }

    if (action === "tag" || action === "normalize_and_tag") {
      resultingTag = await getOrCreateTag(companyId, tagId, tagName, tagColor, transaction);
      await applyTagToContacts(contactIds, resultingTag, transaction);
    }
  });

  const updatedContacts = await Contact.findAll({ where: { id: contactIds } });

  updatedContacts.forEach(contact => {
    if (io) {
      io.of(`/workspace-${companyId}`)
        .emit(`company-${companyId}-contact`, {
          action: "update",
          contact
        });
    }
  });

  for (const contactId of contactIds) {
    try {
      await SyncContactWalletsAndPersonalTagsService({
        companyId,
        contactId,
        source: "tags"
      });
    } catch (err) {
      console.warn("[ProcessContactsNormalizationService] Falha ao sincronizar carteiras e tags pessoais", err);
    }
  }

  return {
    updatedContacts,
    action,
    canonicalNumber,
    tagId: resultingTag?.id,
    tagName: resultingTag?.name
  };
};

export default ProcessContactsNormalizationService;
