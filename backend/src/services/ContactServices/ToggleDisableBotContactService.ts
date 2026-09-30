import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";

interface Request {
  contactId: string;
  companyId: number;
}

const ToggleDisableBotContactService = async ({
  contactId,
  companyId
}: Request): Promise<Contact> => {
  // Segurança: escopo por empresa para evitar IDOR entre tenants
  const contact = await Contact.findOne({
    where: { id: contactId, companyId },
    attributes: ["id", "disableBot"]
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  const disableBot = contact?.disableBot ? false : true;

  await contact.update({
    disableBot
  });

  await contact.reload({
    attributes: [
      "id",
      "name",
      "number",
      "email",
      "profilePicUrl",
      "companyId",
      "acceptAudioMessage",
      "disableBot",
      "urlPicture",
    ],
    include: ["extraInfo"]
  });

  return contact;
};

export default ToggleDisableBotContactService;
