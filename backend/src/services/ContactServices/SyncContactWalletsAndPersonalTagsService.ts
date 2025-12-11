import { Op } from "sequelize";
import ContactWallet from "../../models/ContactWallet";
import ContactTag from "../../models/ContactTag";
import Tag from "../../models/Tag";
import User from "../../models/User";

interface SyncRequest {
  companyId: number;
  contactId: number | string;
  source: "wallet" | "tags";
}

const SyncContactWalletsAndPersonalTagsService = async ({
  companyId,
  contactId,
  source
}: SyncRequest): Promise<void> => {
  const contactIdNum = Number(contactId);

  if (!contactIdNum || Number.isNaN(contactIdNum)) {
    return;
  }

  // Carrega as tags já associadas ao contato
  const contactTagRows = await ContactTag.findAll({
    where: { contactId: contactIdNum }
  });

  // Carrega usuários da empresa com suas allowedContactTags (lista de IDs de tags)
  const users = await User.findAll({
    where: { companyId },
    attributes: ["id", "name", "allowedContactTags"]
  });

  // Descobre todas as tags referenciadas em allowedContactTags para pré-carregar do banco
  const allAllowedTagIds = new Set<number>();
  for (const user of users as any[]) {
    const allowed = Array.isArray(user.allowedContactTags)
      ? (user.allowedContactTags as number[])
      : [];
    for (const tagId of allowed) {
      if (Number.isInteger(tagId)) {
        allAllowedTagIds.add(tagId);
      }
    }
  }

  const allowedTags: any[] = allAllowedTagIds.size
    ? await Tag.findAll({
        where: {
          companyId,
          id: { [Op.in]: Array.from(allAllowedTagIds) }
        },
        attributes: ["id", "name"]
      })
    : [];

  const tagById = new Map<number, any>();
  for (const t of allowedTags) {
    tagById.set(t.id, t);
  }

  const tagIdsOnContact = contactTagRows.map(ct => ct.tagId);

  // Mapeia tags pessoais por usuário e por nome
  const personalTagNameToUserIds = new Map<string, number[]>();
  const userIdToPersonalTagIds = new Map<number, number[]>();

  for (const user of users as any[]) {
    const allowed = Array.isArray(user.allowedContactTags)
      ? (user.allowedContactTags as number[])
      : [];

    for (const tagId of allowed) {
      const t = tagById.get(tagId);
      if (!t) continue;

      const name = (t.name || "").trim();
      if (!name || !name.startsWith("#") || name.startsWith("##")) continue;

      const lower = name.toLowerCase();

      if (!personalTagNameToUserIds.has(lower)) {
        personalTagNameToUserIds.set(lower, []);
      }
      personalTagNameToUserIds.get(lower)!.push(user.id);

      const list = userIdToPersonalTagIds.get(user.id) || [];
      list.push(t.id);
      userIdToPersonalTagIds.set(user.id, list);
    }
  }

  // Descobre quais tags pessoais o contato já possui
  const contactPersonalTagIds: number[] = [];
  const contactPersonalTagNames = new Map<number, string>();

  if (tagIdsOnContact.length > 0) {
    const tags = await Tag.findAll({
      where: {
        companyId,
        id: { [Op.in]: tagIdsOnContact }
      },
      attributes: ["id", "name"]
    });

    for (const t of tags as any[]) {
      const name = (t.name || "").trim();
      if (name.startsWith("#") && !name.startsWith("##")) {
        contactPersonalTagIds.push(t.id);
        contactPersonalTagNames.set(t.id, name);
      }
    }
  }

  if (source === "wallet") {
    // Sincroniza: carteiras -> tags pessoais do contato
    const walletRows = await ContactWallet.findAll({
      where: {
        companyId,
        contactId: contactIdNum
      },
      attributes: ["walletId"]
    });

    const walletUserIds = Array.from(
      new Set(
        (walletRows as any[])
          .map(w => Number(w.walletId))
          .filter(id => Number.isInteger(id))
      )
    );

    const desiredPersonalTagIds = new Set<number>();

    for (const userId of walletUserIds) {
      const list = userIdToPersonalTagIds.get(userId) || [];
      list.forEach(id => desiredPersonalTagIds.add(id));
    }

    // Tags pessoais que devem existir no contato
    const tagsToAdd = Array.from(desiredPersonalTagIds).filter(
      id => !tagIdsOnContact.includes(id)
    );

    if (tagsToAdd.length > 0) {
      await ContactTag.bulkCreate(
        tagsToAdd.map(tagId => ({ contactId: contactIdNum, tagId }))
      );
    }

    // Tags pessoais que o contato tem, mas que não correspondem mais à carteira
    const allowedPersonalTagIds = new Set<number>(desiredPersonalTagIds);
    const tagsToRemove = contactPersonalTagIds.filter(
      id => !allowedPersonalTagIds.has(id)
    );

    if (tagsToRemove.length > 0) {
      await ContactTag.destroy({
        where: {
          contactId: contactIdNum,
          tagId: { [Op.in]: tagsToRemove }
        }
      });
    }

    return;
  }

  if (source === "tags") {
    // Sincroniza: tags pessoais do contato -> carteiras
    const desiredWalletUserIds = new Set<number>();

    for (const tagId of contactPersonalTagIds) {
      const name = contactPersonalTagNames.get(tagId);
      if (!name) continue;

      const usersForTag = personalTagNameToUserIds.get(name.toLowerCase()) || [];
      usersForTag.forEach(id => desiredWalletUserIds.add(id));
    }

    await ContactWallet.destroy({
      where: {
        companyId,
        contactId: contactIdNum
      }
    });

    const walletToInsert = Array.from(desiredWalletUserIds);

    if (walletToInsert.length > 0) {
      await ContactWallet.bulkCreate(
        walletToInsert.map(userId => ({
          walletId: userId,
          contactId: contactIdNum,
          companyId
        }))
      );
    }

    return;
  }
};

export default SyncContactWalletsAndPersonalTagsService;
