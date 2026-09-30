import Tag from "../../models/Tag";
import Contact from "../../models/Contact";
import ContactTag from "../../models/ContactTag";

interface Request {
  tags: Tag[];
  contactId: number;
  companyId: number;
}

const SyncTags = async ({
  tags,
  contactId,
  companyId
}: Request): Promise<Contact | null> => {
  // Filtra por companyId para impedir sync em contato de outra empresa
  const contact = await Contact.findOne({
    where: { id: contactId, companyId },
    include: [Tag]
  });

  if (!contact) {
    return null;
  }

  const tagList = tags.map(t => ({ tagId: t.id, contactId, companyId }));

  await ContactTag.destroy({ where: { contactId, companyId } });
  await ContactTag.bulkCreate(tagList);

  await contact.reload();

  return contact;
};

export default SyncTags;
