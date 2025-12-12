import * as Yup from "yup";
import AppError from "../../errors/AppError";
import ContactListItem from "../../models/ContactListItem";
import logger from "../../utils/logger";
import CheckContactNumber from "../WbotServices/CheckNumber";
import { isValidCanonicalPhoneNumber, safeNormalizePhoneNumber } from "../../utils/phone";

interface Data {
  name: string;
  number: string;
  contactListId: number;
  companyId: number;
  email?: string;
}

const CreateService = async (data: Data): Promise<ContactListItem> => {
  const { name } = data;

  const contactListItemSchema = Yup.object().shape({
    name: Yup.string()
      .min(3, "ERR_CONTACTLISTITEM_INVALID_NAME")
      .required("ERR_CONTACTLISTITEM_REQUIRED")
  });

  try {
    await contactListItemSchema.validate({ name });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const isGroup = (data as any)?.isGroup === true;
  const rawNumber = String(data.number || "").trim();

  if (!isGroup) {
    const { canonical } = safeNormalizePhoneNumber(rawNumber);
    if (!canonical || !isValidCanonicalPhoneNumber(canonical)) {
      throw new AppError("Número inválido");
    }
    data.number = canonical;
  } else {
    if (!rawNumber) {
      throw new AppError("Número inválido");
    }
  }

  const shouldValidateWhatsapp =
    String(process.env.CONTACT_LIST_VALIDATE_WHATSAPP || "false").toLowerCase() === "true";

  if (shouldValidateWhatsapp) {
    try {
      const validated = await CheckContactNumber(data.number, data.companyId, isGroup);
      data.number = validated;
      (data as any).isWhatsappValid = true;
      (data as any).validatedAt = new Date();
    } catch (e: any) {
      // Quando a validação via WhatsApp estiver habilitada, bloquear inserção se não existir.
      const msg = e?.message || "";
      logger.error(`Número de contato inválido (WhatsApp): ${data.number}`);
      throw new AppError(msg || "Número inválido");
    }
  }

  const [record] = await ContactListItem.findOrCreate({
    where: {
      number: data.number,
      companyId: data.companyId,
      contactListId: data.contactListId
    },
    defaults: data
  });

  // Se não validou via WhatsApp, deixar como "não validado" (null)
  if (!shouldValidateWhatsapp) {
    record.isWhatsappValid = record.isWhatsappValid ?? null;
  }

  return record;
};

export default CreateService;
