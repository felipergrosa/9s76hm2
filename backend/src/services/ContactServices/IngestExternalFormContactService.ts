import Contact from "../../models/Contact";
import UpdateContactService from "./UpdateContactService";
import { safeNormalizePhoneNumber } from "../../utils/phone";
import AppError from "../../errors/AppError";

interface Request {
  companyId: number;
  payload: Record<string, any>;
}

const RESERVED_KEYS = ["number", "phone", "name", "email"];

function inferType(value: any): string {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "text";
}

/**
 * Recebe um payload externo (ex: bloco "Webhook" de um fluxo Typebot já
 * vinculado a uma conversa do WhatsApp) e atualiza/cria o Contact com os
 * campos coletados como ContactCustomField tipados (ver item 4 do plano).
 *
 * Contrato do payload: { number ou phone (obrigatório), name?, email?, ...quaisquer outros campos }
 * Qualquer chave fora de number/phone/name/email se torna um campo customizado tipado
 * automaticamente (number/boolean/text conforme o tipo do valor recebido no JSON).
 */
const IngestExternalFormContactService = async ({
  companyId,
  payload
}: Request): Promise<Contact> => {
  const rawNumber = payload.number || payload.phone;
  if (!rawNumber) {
    throw new AppError("Campo 'number' (ou 'phone') é obrigatório");
  }

  const { canonical } = safeNormalizePhoneNumber(String(rawNumber));
  const number = canonical || String(rawNumber).replace(/\D/g, "");

  let contact = await Contact.findOne({
    where: { number, companyId },
    include: ["extraInfo"]
  });

  if (!contact) {
    contact = await Contact.create({
      name: payload.name || number,
      number,
      email: payload.email || undefined,
      companyId,
      isWhatsappValid: false
    } as any);
    contact.extraInfo = [];
  }

  const newFields = Object.keys(payload)
    .filter(key => !RESERVED_KEYS.includes(key))
    .map(key => ({
      name: key,
      value: String(payload[key]),
      type: inferType(payload[key])
    }));

  const existingFields = (contact.extraInfo || []).map(field => ({
    id: field.id,
    name: field.name,
    value: field.value,
    type: field.type,
    options: field.options
  }));

  await UpdateContactService({
    contactId: String(contact.id),
    companyId,
    contactData: {
      extraInfo: [...existingFields, ...newFields]
    }
  });

  return Contact.findByPk(contact.id, { include: ["extraInfo"] });
};

export default IngestExternalFormContactService;
