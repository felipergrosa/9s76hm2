import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import CreateContactService from "./CreateContactService";
import { safeNormalizePhoneNumber } from "../../utils/phone";

interface ExtraInfo extends ContactCustomField {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  companyId: number;
  email?: string;
  acceptAudioMessage?: boolean;
  active?: boolean;
  profilePicUrl?: string;
  extraInfo?: ExtraInfo[];
  cpfCnpj?: string;
}

const GetContactService = async ({
  name,
  number,
  cpfCnpj,
  companyId
}: Request): Promise<Contact> => {
  const { canonical } = safeNormalizePhoneNumber(number);

  if (!canonical) {
    throw new AppError("ERR_INVALID_PHONE_NUMBER");
  }

  const numberExists = await Contact.findOne({
    where: { companyId, canonicalNumber: canonical }
  });

  if (!numberExists) {
    const contact = await CreateContactService({
      name,
      number: canonical,
      companyId
    });

    if (contact == null) throw new AppError("CONTACT_NOT_FIND");
    else return contact;
  }

  return numberExists;
};

export default GetContactService;
