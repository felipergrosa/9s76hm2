import Tag from "../../models/Tag";
import Contact from "../../models/Contact";
import ContactTag from "../../models/ContactTag";
import SyncContactWalletsAndPersonalTagsService from "../ContactServices/SyncContactWalletsAndPersonalTagsService";

interface Request {
  tags: Tag[];
  contactId: number;
}

const SyncTags = async ({
  tags,
  contactId
}: Request): Promise<Contact | null> => {
  const contact = await Contact.findByPk(contactId, { include: [Tag] });

  const tagList = tags.map(t => ({ tagId: t.id, contactId }));

  await ContactTag.destroy({ where: { contactId } });
  await ContactTag.bulkCreate(tagList);

  if (contact) {
    try {
      await SyncContactWalletsAndPersonalTagsService({
        companyId: contact.companyId,
        contactId: contact.id,
        source: "tags"
      });
    } catch (err) {
      console.warn("[SyncTagsService] Falha ao sincronizar carteiras e tags pessoais", err);
    }

    await contact.reload();
  }

  return contact;
};

export default SyncTags;
