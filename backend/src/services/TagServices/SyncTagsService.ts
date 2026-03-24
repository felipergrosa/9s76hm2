import Tag from "../../models/Tag";
import Contact from "../../models/Contact";
import ContactTag from "../../models/ContactTag";

interface Request {
  tags: Tag[];
  contactId: number;
}

const SyncTags = async ({
  tags,
  contactId
}: Request): Promise<Contact | null> => {
  const contact = await Contact.findByPk(contactId, { include: [Tag] });

  if (!contact) {
    return null;
  }

  const tagList = tags.map(t => ({ tagId: t.id, contactId, companyId: contact.companyId }));

  await ContactTag.destroy({ where: { contactId } });
  await ContactTag.bulkCreate(tagList);

  await contact.reload();

  return contact;
};

export default SyncTags;
