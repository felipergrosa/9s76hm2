import { head } from "lodash";
import XLSX from "xlsx";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import ContactList from "../../models/ContactList";
import ContactListItem from "../../models/ContactListItem";
import Tag from "../../models/Tag";
import ContactTag from "../../models/ContactTag";
import CreateOrUpdateContactServiceForImport from "./CreateOrUpdateContactServiceForImport";
import CheckContactNumber from "../WbotServices/CheckNumber";
import { safeNormalizePhoneNumber } from "../../utils/phone";
import logger from "../../utils/logger";

export interface LeadInput {
  name?: string;
  razaoSocial?: string;
  phone?: string;
  number?: string;
  email?: string;
  cnpj?: string;
  cnae?: string;
  porte?: string;
  segmento?: string;
  cidade?: string;
  uf?: string;
  endereco?: string;
  website?: string;
  googleMapsUrl?: string;
}

interface Request {
  companyId: number;
  leads?: LeadInput[];
  file?: Express.Multer.File;
  contactListName?: string;
  tagName?: string;
  validateNumber?: boolean;
}

const PORTE_OPTIONS = ["MEI", "Pequena", "Média", "Grande"];

// Lê um arquivo XLSX/CSV no mesmo formato usado pelos demais imports do
// sistema e mapeia colunas comuns de planilhas de lead-gen (CNPJ + Google
// Maps) para o formato interno de LeadInput.
function parseLeadsFile(file: Express.Multer.File): LeadInput[] {
  const workbook = XLSX.readFile(file.path);
  const worksheet = head(Object.values(workbook.Sheets)) as any;
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 0 });

  const pick = (row: any, ...keys: string[]) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
        return String(row[key]).trim();
      }
    }
    return "";
  };

  return rows.map(row => ({
    name: pick(row, "name", "nome", "Nome", "razaoSocial", "Razão Social"),
    razaoSocial: pick(row, "razaoSocial", "Razão Social", "razao_social"),
    phone: pick(row, "phone", "telefone", "Telefone", "number", "numero", "número"),
    email: pick(row, "email", "Email", "e-mail", "E-mail"),
    cnpj: pick(row, "cnpj", "CNPJ"),
    cnae: pick(row, "cnae", "CNAE"),
    porte: pick(row, "porte", "Porte"),
    segmento: pick(row, "segmento", "Segmento", "segment"),
    cidade: pick(row, "cidade", "Cidade", "city"),
    uf: pick(row, "uf", "UF", "estado"),
    endereco: pick(row, "endereco", "endereço", "Endereço", "address"),
    website: pick(row, "website", "Website", "site"),
    googleMapsUrl: pick(row, "googleMapsUrl", "google_maps_url", "Google Maps", "maps")
  }));
}

// Cria/atualiza, para um contato já existente, os campos sem coluna nativa em
// Contact (CNAE, porte, site, link do Google Maps) como ContactCustomField
// tipados (item 4 do plano). findOrCreate por nome evita duplicar a mesma
// chave em reimportações.
async function upsertTypedCustomFields(contactId: number, lead: LeadInput) {
  const entries: Array<{ name: string; value: string; type: string; options?: string[] }> = [];

  if (lead.cnae) entries.push({ name: "CNAE", value: lead.cnae, type: "text" });
  if (lead.porte) entries.push({ name: "Porte", value: lead.porte, type: "select", options: PORTE_OPTIONS });
  if (lead.website) entries.push({ name: "Website", value: lead.website, type: "text" });
  if (lead.googleMapsUrl) entries.push({ name: "Google Maps", value: lead.googleMapsUrl, type: "text" });
  if (lead.endereco) entries.push({ name: "Endereço", value: lead.endereco, type: "text" });

  for (const entry of entries) {
    const [field] = await ContactCustomField.findOrCreate({
      where: { contactId, name: entry.name },
      defaults: { ...entry, contactId } as any
    });
    if (field.value !== entry.value) {
      await field.update({ value: entry.value, type: entry.type, options: entry.options as any });
    }
  }
}

const ImportLeadsService = async ({
  companyId,
  leads,
  file,
  contactListName,
  tagName,
  validateNumber = false
}: Request) => {
  const items: LeadInput[] = leads && leads.length > 0 ? leads : file ? parseLeadsFile(file) : [];

  if (items.length === 0) {
    throw new Error("Nenhum lead informado para importação");
  }

  const MAX_LEADS_PER_IMPORT = 10000;
  if (items.length > MAX_LEADS_PER_IMPORT) {
    throw new Error(`Limite de ${MAX_LEADS_PER_IMPORT} leads por importação excedido. Total: ${items.length}`);
  }

  let contactList: ContactList | null = null;
  if (contactListName) {
    [contactList] = await ContactList.findOrCreate({
      where: { name: contactListName, companyId },
      defaults: { name: contactListName, companyId }
    });
  }

  let tag: Tag | null = null;
  if (tagName) {
    [tag] = await Tag.findOrCreate({
      where: { name: tagName, companyId },
      defaults: { name: tagName, companyId, color: "#A4CCCC", kanban: 0 }
    });
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ index: number; reason: string }> = [];

  for (let i = 0; i < items.length; i++) {
    const lead = items[i];
    const rawNumber = String(lead.phone || lead.number || "").replace(/\D/g, "");

    if (!rawNumber || rawNumber.length < 8) {
      skipped++;
      errors.push({ index: i, reason: "Telefone inválido ou ausente" });
      continue;
    }

    try {
      let number = rawNumber;
      if (validateNumber) {
        try {
          const normalized = await CheckContactNumber(number, companyId);
          if (normalized) number = String(normalized);
        } catch (e: any) {
          logger.warn(`[ImportLeadsService] Falha ao validar número ${number}: ${e?.message}`);
        }
      }

      const { canonical } = safeNormalizePhoneNumber(number);
      const existing = await Contact.findOne({
        where: { companyId, canonicalNumber: canonical || number }
      });

      const contact = await CreateOrUpdateContactServiceForImport({
        name: lead.name || lead.razaoSocial || number,
        number,
        isGroup: false,
        email: lead.email || "",
        companyId,
        cpfCnpj: lead.cnpj,
        city: lead.cidade,
        region: lead.uf,
        fantasyName: lead.name,
        segment: lead.segmento,
        silentMode: true
      });

      await upsertTypedCustomFields(contact.id, lead);

      if (tag) {
        await ContactTag.findOrCreate({
          where: { contactId: contact.id, tagId: tag.id },
          defaults: { contactId: contact.id, tagId: tag.id, companyId } as any
        });
      }

      if (contactList) {
        const { canonical: itemCanonical } = safeNormalizePhoneNumber(number);
        await ContactListItem.findOrCreate({
          where: {
            canonicalNumber: itemCanonical || number,
            contactListId: contactList.id,
            companyId
          },
          defaults: {
            name: contact.name,
            number,
            email: lead.email || "",
            canonicalNumber: itemCanonical || number,
            contactListId: contactList.id,
            companyId
          } as any
        });
      }

      if (existing) updated++;
      else created++;
    } catch (error: any) {
      skipped++;
      errors.push({ index: i, reason: error?.message || "Erro desconhecido" });
      logger.error(`[ImportLeadsService] Erro no lead ${i}: ${error?.message}`);
    }
  }

  return {
    total: items.length,
    created,
    updated,
    skipped,
    errors,
    contactListId: contactList?.id,
    tagId: tag?.id
  };
};

export default ImportLeadsService;
