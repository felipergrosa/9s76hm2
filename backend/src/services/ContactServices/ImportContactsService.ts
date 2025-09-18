import { head } from "lodash";
import XLSX from "xlsx";
import { has } from "lodash";
import ContactListItem from "../../models/ContactListItem";
import CheckContactNumber from "../WbotServices/CheckNumber";
import logger from "../../utils/logger";
import Contact from "../../models/Contact";
import Tag from "../../models/Tag";
import ContactTag from "../../models/ContactTag";
import GetDeviceContactsService from "../WbotServices/GetDeviceContactsService";
import { getAllChatLabels, getLabelMap } from "../../libs/labelCache";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
// import CheckContactNumber from "../WbotServices/CheckNumber";

export async function ImportContactsService(
  companyId: number,
  file: Express.Multer.File | undefined,
  tagMapping?: any,
  whatsappId?: number
) {
  let contacts: any[] = [];

  if (tagMapping) {
    // Import a partir das etiquetas do WhatsApp (device) com mapeamento
    const mappedDeviceTagIds: string[] = Object.keys(tagMapping || {}).map(String);

    // Resolver whatsappId efetivo (número) para acessar o cache correto
    const defWpp = await GetDefaultWhatsApp(whatsappId, companyId);
    const effectiveWhatsAppId = defWpp.id;

    // 1) Obter associações chat->labels do cache e derivar os JIDs que possuem QUALQUER das labels selecionadas
    const chatLabels = getAllChatLabels(effectiveWhatsAppId);
    const selectedJids = new Set<string>();
    for (const [chatId, set] of chatLabels.entries()) {
      const id = String(chatId);
      // Ignorar grupos e JIDs inválidos
      if (!id.includes('@') || id.endsWith('@g.us')) continue;
      const has = Array.from(set.values()).some(lid => mappedDeviceTagIds.includes(String(lid)));
      if (has) selectedJids.add(id);
    }
    logger.info(`[ImportContactsService] JIDs selecionados por labels (${mappedDeviceTagIds.join(', ')}): ${selectedJids.size}`);

    // 2) Obter contatos do dispositivo (para nomes) e filtrar pelos JIDs coletados
    const deviceContacts = await GetDeviceContactsService(companyId, whatsappId);
    const byJid = new Map<string, any>(deviceContacts.map(c => [String(c.id), c]));

    const labelMap = getLabelMap(effectiveWhatsAppId);
    contacts = Array.from(selectedJids).map(jid => {
      const c = byJid.get(jid) || { id: jid, name: '', notify: '', tags: [] };
      // Dispositivo: garantir que deviceTags inclua apenas as labels selecionadas
      const deviceTags = (Array.isArray(c.tags) ? c.tags : []).filter((t: any) => mappedDeviceTagIds.includes(String(t.id)));
      // Se não veio no contato, cria tags pelo mapa de labels
      const ensured = deviceTags.length > 0 ? deviceTags : mappedDeviceTagIds
        .filter(lid => (chatLabels.get(jid)?.has(String(lid))) )
        .map(lid => ({ id: String(lid), name: (labelMap.get(String(lid)) as any)?.name || String(lid) }));

      return {
        name: (c.name || c.notify || '').trim(),
        number: String(jid).split('@')[0] || '',
        email: '',
        companyId,
        deviceTags: ensured
      };
    });
    logger.info(`[ImportContactsService] Contatos derivados de labels: ${contacts.length}`);
  } else {
    // Import from Excel file (existing logic)
    const workbook = XLSX.readFile(file?.path as string);
    const worksheet = head(Object.values(workbook.Sheets)) as any;
    const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 0 });

    contacts = rows.map(row => {
      let name = "";
      let number = "";
      let email = "";
      let cpfCnpj = "";
      let representativeCode = "";
      let city = "";
      let instagram = "";
      let situation = "";
      let fantasyName = "";
      let foundationDate = null;
      let creditLimit = "";

      if (has(row, "cpfCnpj") || has(row, "CPF/CNPJ") || has(row, "cpf") || has(row, "CPF")) {
        cpfCnpj = row["cpfCnpj"] || row["CPF/CNPJ"] || row["cpf"] || row["CPF"];
      }

      if (has(row, "representativeCode") || has(row, "Código do Representante")) {
        representativeCode = row["representativeCode"] || row["Código do Representante"];
      }

      if (has(row, "city") || has(row, "Cidade")) {
        city = row["city"] || row["Cidade"];
      }

      if (has(row, "instagram") || has(row, "Instagram")) {
        instagram = row["instagram"] || row["Instagram"];
      }

      if (has(row, "situation") || has(row, "Situação")) {
        situation = row["situation"] || row["Situação"];
      }

      if (has(row, "fantasyName") || has(row, "Nome Fantasia")) {
        fantasyName = row["fantasyName"] || row["Nome Fantasia"];
      }

      if (has(row, "foundationDate") || has(row, "Data de Fundação")) {
        foundationDate = row["foundationDate"] || row["Data de Fundação"];
      }

      if (has(row, "creditLimit") || has(row, "Limite de Crédito")) {
        creditLimit = row["creditLimit"] || row["Limite de Crédito"];
      }

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

      return {
        name,
        number,
        email,
        cpfCnpj,
        representativeCode,
        city,
        instagram,
        situation,
        fantasyName,
        foundationDate,
        creditLimit,
        companyId
      };
    });
  }


  const contactList: Contact[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let taggedCount = 0;
  const perTagApplied: Record<string, number> = {};

  for (const incoming of contacts) {
    const number = `${incoming.number}`;
    const companyIdRow = incoming.companyId;

    const existing = await Contact.findOne({ where: { number, companyId: companyIdRow } });
    let contact: Contact;

    if (!existing) {
      // Criar novo contato
      const payload: any = {
        ...incoming,
        email: typeof incoming.email === 'string' ? incoming.email : ''
      };
      // Remove deviceTags from payload as it's not a model field
      delete payload.deviceTags;
      // Se contato novo vier sem nome, define como o próprio número
      if (!payload.name || String(payload.name).trim() === '') {
        payload.name = number;
      }
      contact = await Contact.create(payload);
      contactList.push(contact);
      createdCount++;
    } else {
      contact = existing;

      // Update não destrutivo: só atualiza campos vazios/placeholder
      const updatePayload: any = {};

      // Nome: atualiza se vazio ou igual ao número; se já curado, apenas registra em contactName
      const currentName = (existing.name || '').trim();
      const isNumberName = currentName.replace(/\D/g, '') === number;
      const incomingName = (incoming.name || '').trim();
      if ((!currentName || isNumberName) && incomingName) {
        updatePayload.name = incomingName;
      } else if (incomingName) {
        // preserva nome curado e salva referência
        updatePayload.contactName = incomingName;
      }

      // Email: salva se atual vazio (""), e veio na planilha
      const currentEmail = (existing.email || '').trim();
      if (!currentEmail && incoming.email) {
        updatePayload.email = String(incoming.email).trim();
      }

      // Campos adicionais: apenas se atuais forem nulos/vazios e houver valor na planilha
      const keepIfEmpty = (key: string) => {
        const val = (incoming as any)[key];
        if (val === undefined || val === null || (typeof val === 'string' && val.toString().trim() === '')) return;
        const current = (existing as any)[key];
        if (current === null || current === undefined || (typeof current === 'string' && String(current).trim() === '')) {
          (updatePayload as any)[key] = typeof val === 'string' ? val.toString().trim() : val;
        }
      };

      keepIfEmpty('cpfCnpj');
      keepIfEmpty('representativeCode');
      keepIfEmpty('city');
      keepIfEmpty('instagram');
      keepIfEmpty('situation');
      keepIfEmpty('fantasyName');
      keepIfEmpty('foundationDate');
      keepIfEmpty('creditLimit');
      keepIfEmpty('segment');

      if (Object.keys(updatePayload).length > 0) {
        await existing.update(updatePayload);
        updatedCount++;
      }
    }

    // Handle tag associations for device contacts
    if (tagMapping && incoming.deviceTags) {
      for (const deviceTag of incoming.deviceTags) {
        const mapping = tagMapping[deviceTag.id];
        if (mapping) {
          let systemTagId = null;

          if (mapping.systemTagId) {
            // Use existing system tag
            systemTagId = mapping.systemTagId;
          } else if (mapping.newTagName) {
            // Create new tag
            const [newTag] = await Tag.findOrCreate({
              where: { name: mapping.newTagName, companyId },
              defaults: { color: "#A4CCCC", kanban: 0 }
            });
            systemTagId = newTag.id;
          }

          if (systemTagId) {
            // Associate tag with contact
            await ContactTag.findOrCreate({
              where: { contactId: contact.id, tagId: systemTagId }
            });
            taggedCount++;
            // Nome da etiqueta para o relatório
            let tagNameForReport: string | null = null;
            if (mapping.systemTagId) {
              try {
                const t = await Tag.findByPk(systemTagId as any);
                tagNameForReport = t?.name || null;
              } catch (_) { /* ignore */ }
            } else if (mapping.newTagName) {
              tagNameForReport = mapping.newTagName;
            }
            if (!tagNameForReport) {
              tagNameForReport = deviceTag?.name || String(deviceTag?.id || '');
            }
            perTagApplied[tagNameForReport] = (perTagApplied[tagNameForReport] || 0) + 1;
          }
        }
      }
    }
  }

  // Verifica se existe os contatos
  // if (contactList) {
  //   for (let newContact of contactList) {
  //     try {
  //       const response = await CheckContactNumber(newContact.number, companyId);
  //       const number = response;
  //       newContact.number = number;
  //       console.log('number', number)
  //       await newContact.save();
  //     } catch (e) {
  //       logger.error(`Número de contato inválido: ${newContact.number}`);
  //     }
  //   }
  // }

  return {
    total: contacts.length,
    created: createdCount,
    updated: updatedCount,
    tagged: taggedCount,
    perTagApplied,
    contacts: contactList
  };
}
