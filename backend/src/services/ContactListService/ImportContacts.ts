import { head } from "lodash";
import XLSX from "xlsx";
import { has } from "lodash";
import ContactListItem from "../../models/ContactListItem";
import ContactList from "../../models/ContactList";
import AppError from "../../errors/AppError";
import CheckContactNumber from "../WbotServices/CheckNumber";
import { CheckNumbersOfficialBatch } from "../MetaServices/CheckNumberOfficial";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import { safeNormalizePhoneNumber } from "../../utils/phone";

export async function ImportContacts(
  contactListId: number,
  companyId: number,
  file: Express.Multer.File | undefined
) {
  // Segurança: valida que a lista pertence à empresa antes de importar (IDOR)
  const list = await ContactList.findOne({
    where: { id: contactListId, companyId }
  });
  if (!list) {
    throw new AppError("ERR_NO_CONTACTLIST_FOUND", 404);
  }

  const workbook = XLSX.readFile(file?.path as string);
  const worksheet = head(Object.values(workbook.Sheets)) as any;
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 0 });
  const contacts = rows.map(row => {
    let name = "";
    let number = "";
    let email = "";

    if (has(row, "nome") || has(row, "Nome")) {
      name = row["nome"] || row["Nome"];
    }

    if (
      has(row, "numero") ||
      has(row, "número") ||
      has(row, "Numero") ||
      has(row, "Número")
    ) {
      number = row["numero"] || row["número"] || row["Numero"] || row["Número"];
      number = `${number}`.replace(/\D/g, "");
    }

    if (
      has(row, "email") ||
      has(row, "e-mail") ||
      has(row, "Email") ||
      has(row, "E-mail")
    ) {
      email = row["email"] || row["e-mail"] || row["Email"] || row["E-mail"];
    }

    // Normalizar número para garantir associação correta com Contact
    const { canonical } = safeNormalizePhoneNumber(number);
    const canonicalNumber = canonical || number.replace(/\D/g, "");
    
    return { name, number, email, canonicalNumber, contactListId, companyId };
  });

  const contactList: ContactListItem[] = [];

  for (const contact of contacts) {
    // Usar canonicalNumber para busca para evitar duplicatas com formatos diferentes
    const [newContact, created] = await ContactListItem.findOrCreate({
      where: {
        canonicalNumber: contact.canonicalNumber,
        contactListId: contact.contactListId,
        companyId: contact.companyId
      },
      defaults: contact
    });
    if (created) {
      contactList.push(newContact);
    }
  }

  if (contactList && contactList.length > 0) {
    // Validação na criação da lista — escolhe o canal disponível:
    // prioriza API Oficial (batch /contacts da Graph API) e cai para
    // Baileys (onWhatsApp). Contatos com erro de API ficam com
    // isWhatsappValid=null — o worker validateWhatsappContacts re-tenta.
    const officialWhatsapp = await Whatsapp.findOne({
      where: { companyId, channelType: "official", status: "CONNECTED" }
    });
    const useOfficial = !!(
      officialWhatsapp?.wabaPhoneNumberId && officialWhatsapp?.wabaAccessToken
    );

    if (useOfficial) {
      try {
        const batchResult = await CheckNumbersOfficialBatch(
          contactList.map(c => c.number),
          companyId,
          100
        );
        for (let i = 0; i < contactList.length; i++) {
          const newContact = contactList[i];
          const result = batchResult.results[i];
          try {
            if (result?.status === "valid" && result.wa_id) {
              newContact.number = result.wa_id;
              newContact.isWhatsappValid = true;
            } else if (result?.status === "invalid") {
              newContact.isWhatsappValid = false;
            }
            // status "error" → mantém null para revalidação posterior
            await newContact.save();
          } catch (e) {
            logger.error(`Número de contato inválido: ${newContact.number}`);
          }
        }
      } catch (err: any) {
        logger.error(
          `[ImportContacts] Validação oficial em lote falhou (contatos ficam pendentes): ${err?.message}`
        );
      }
    } else {
      for (let newContact of contactList) {
        try {
          const response = await CheckContactNumber(newContact.number, companyId);
          newContact.isWhatsappValid = response ? true : false;
          const number = response;
          newContact.number = number;
          await newContact.save();
        } catch (e) {
          logger.error(`Número de contato inválido: ${newContact.number}`);
        }
      }
    }
  }

  return contactList;
}
