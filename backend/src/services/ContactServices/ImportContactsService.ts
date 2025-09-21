import { head } from "lodash";
import XLSX from "xlsx";
import { has } from "lodash";

import ContactListItem from "../../models/ContactListItem";
import CheckContactNumber from "../WbotServices/CheckNumber";
import logger from "../../utils/logger";
import Contact from "../../models/Contact";
import Tag from "../../models/Tag";
import ContactTag from "../../models/ContactTag";
// Removido: importações de cache/baileys
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import WhatsAppWebLabelsService from "../WbotServices/WhatsAppWebLabelsService";

// import CheckContactNumber from "../WbotServices/CheckNumber";

// Progresso em memória por progressId
type ImportProgress = {
  total: number;
  processed: number;
  created: number;
  updated: number;
  tagged: number;
};
const importProgressMap: Map<string, ImportProgress> = new Map();

export function getImportProgress(progressId: string) {
  if (!progressId) return { total: 0, processed: 0, created: 0, updated: 0, tagged: 0 };
  return importProgressMap.get(progressId) || { total: 0, processed: 0, created: 0, updated: 0, tagged: 0 };
}

export function resetImportProgress(progressId: string) {
  if (!progressId) return;
  importProgressMap.delete(progressId);
}

export async function ImportContactsService(
  companyId: number,
  file: Express.Multer.File | undefined,
  tagMapping?: any,
  whatsappId?: number
) {
  let contacts: any[] = [];
  const options = (tagMapping && tagMapping.__options) ? tagMapping.__options : {};
  const validateNumber = !!options.validateNumber;
  const defaultUnlabeledTagName = typeof options.defaultUnlabeledTagName === 'string' ? options.defaultUnlabeledTagName.trim() : '';
  const progressId: string = options.progressId ? String(options.progressId) : '';

  if (tagMapping) {
    // Importação exclusivamente via WhatsApp-Web.js
    const mappedDeviceTagIds: string[] = Object.keys(tagMapping || {}).map(String);
    const defWpp = await GetDefaultWhatsApp(whatsappId, companyId);
    const effectiveWhatsAppId = defWpp.id;

    // Obter inventário de labels para mapear id -> name
    const deviceLabels = await WhatsAppWebLabelsService.getDeviceLabels(companyId, effectiveWhatsAppId);
    const labelNameMap = new Map<string, string>(
      deviceLabels.map(l => [String(l.id), String(l.name)])
    );
    // Apenas IDs válidos presentes no inventário do dispositivo (+ __unlabeled__)
    const validIds = new Set<string>(deviceLabels.map(l => String(l.id)));
    validIds.add("__unlabeled__");
    const selectedIds = mappedDeviceTagIds.filter(id => validIds.has(String(id)));

    const addContact = (acc: Map<string, any>, c: any, ensureLabelId?: string) => {
      // Nome e número
      const jid = String(c?.id || c?.jid || "");
      const number = String(c?.number || jid.split('@')[0] || "").replace(/\D/g, "");
      if (!number) return acc;
      const name = String(c?.name || c?.pushname || c?.notify || number).trim();

      // Tags do dispositivo (mantém apenas as selecionadas)
      const rawTags = Array.isArray(c?.tags) ? c.tags : [];
      let deviceTags = rawTags
        .filter((t: any) => selectedIds.includes(String(t.id)) && String(t.id) !== "__unlabeled__")
        .map((t: any) => ({ id: String(t.id), name: String(t.name || labelNameMap.get(String(t.id)) || t.id) }));

      // Garante tag selecionada específica quando vier contato de uma label
      if (ensureLabelId && ensureLabelId !== "__unlabeled__") {
        const exists = deviceTags.some(t => String(t.id) === String(ensureLabelId));
        if (!exists) {
          deviceTags.push({ id: String(ensureLabelId), name: String(labelNameMap.get(String(ensureLabelId)) || ensureLabelId) });
        }
      }

      // Merge por número
      const existing = acc.get(number);
      if (existing) {
        const merged = new Map<string, any>();
        [...existing.deviceTags, ...deviceTags].forEach((t: any) => merged.set(String(t.id), t));
        existing.deviceTags = Array.from(merged.values());
        if (!existing.name || existing.name === existing.number) existing.name = name;
        acc.set(number, existing);
      } else {
        acc.set(number, { name, number, email: '', companyId, deviceTags });
      }
      return acc;
    };

    const acc = new Map<string, any>();
    // Para cada label selecionada (exceto __unlabeled__), obter contatos diretamente do WhatsApp‑Web.js
    for (const lid of selectedIds.filter(id => id !== "__unlabeled__")) {
      try {
        const contactsByLabel = await (WhatsAppWebLabelsService as any).getContactsByLabel(companyId, String(lid), effectiveWhatsAppId);
        for (const c of contactsByLabel) addContact(acc, c, String(lid));
      } catch (e: any) {
        logger.warn(`[ImportContactsService] Falha ao obter contatos para label ${lid}: ${e?.message}`);
      }
    }

    // "Sem etiqueta"
    if (selectedIds.includes("__unlabeled__")) {
      try {
        const unlabeledContacts = await (WhatsAppWebLabelsService as any).getContactsByLabel(companyId, "__unlabeled__", effectiveWhatsAppId);
        for (const c of unlabeledContacts) addContact(acc, c);
      } catch (e: any) {
        logger.warn(`[ImportContactsService] Falha ao obter contatos sem etiqueta: ${e?.message}`);
      }
    }

    contacts = Array.from(acc.values());
    logger.info(`[ImportContactsService] Contatos via WhatsApp-Web.js: ${contacts.length}`);
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

  // Inicializa progresso
  if (progressId) {
    importProgressMap.set(progressId, {
      total: contacts.length,
      processed: 0,
      created: 0,
      updated: 0,
      tagged: 0
    });
  }

  for (const incoming of contacts) {
    let number = `${incoming.number}`;
    // Validação/normalização opcional do número
    if (validateNumber) {
      try {
        const normalized = await CheckContactNumber(number, companyId);
        if (normalized) number = `${normalized}`;
      } catch (e) {
        logger.warn(`[ImportContactsService] Número inválido/inesperado ao normalizar: ${number} — mantendo original`);
      }
    }
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
    if (tagMapping) {
      // 1) Aplicar mapeamentos de labels reais presentes no contato
      if (incoming.deviceTags) for (const deviceTag of incoming.deviceTags) {
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

      // 2) Aplicar mapeamento especial de "Sem etiqueta" (mesmo sem deviceTags no contato)
      const hasExplicitUnlabeled = !!tagMapping["__unlabeled__"];
      const mapping = hasExplicitUnlabeled ? tagMapping["__unlabeled__"] : (defaultUnlabeledTagName ? { newTagName: defaultUnlabeledTagName } : null);
      if (mapping) {
        let systemTagId = null as any;
        if (mapping.systemTagId) {
          systemTagId = mapping.systemTagId;
        } else if (mapping.newTagName) {
          const [newTag] = await Tag.findOrCreate({
            where: { name: mapping.newTagName, companyId },
            defaults: { color: "#A4CCCC", kanban: 0 }
          });
          systemTagId = newTag.id;
        }
        if (systemTagId) {
          await ContactTag.findOrCreate({ where: { contactId: contact.id, tagId: systemTagId } });
          taggedCount++;
          const tagNameForReport = mapping.newTagName || (await Tag.findByPk(systemTagId))?.name || "Sem etiqueta";
          perTagApplied[tagNameForReport] = (perTagApplied[tagNameForReport] || 0) + 1;
        }
      }
    }

    // Atualiza progresso por iteração
    if (progressId) {
      const p = importProgressMap.get(progressId);
      if (p) {
        p.processed += 1;
        p.created = createdCount;
        p.updated = updatedCount;
        p.tagged = taggedCount;
        importProgressMap.set(progressId, p);
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

  const result = {
    total: contacts.length,
    created: createdCount,
    updated: updatedCount,
    tagged: taggedCount,
    perTagApplied,
    contacts: contactList
  };

  // Limpa o progresso em memória para este progressId
  if (progressId) {
    try { resetImportProgress(progressId); } catch (_) { /* ignore */ }
  }

  return result;
}
