import { head } from "lodash";
import XLSX from "xlsx";
import { has } from "lodash";

import ContactListItem from "../../models/ContactListItem";
import CheckContactNumber from "../WbotServices/CheckNumber";
import logger from "../../utils/logger";
import Contact from "../../models/Contact";
import Tag from "../../models/Tag";
import ContactTag from "../../models/ContactTag";
import ContactTagImportPreset from "../../models/ContactTagImportPreset";
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

import CreateOrUpdateContactServiceForImport from "./CreateOrUpdateContactServiceForImport"; // Importar o serviço
import SyncContactWalletsAndPersonalTagsService from "./SyncContactWalletsAndPersonalTagsService";

export async function ImportContactsService(
  companyId: number,
  file: Express.Multer.File | undefined,
  tagMapping?: any,
  whatsappId?: number,
  silentMode?: boolean,
  dryRunArg?: boolean
) {
  let contacts: any[] = [];
  let effectiveTagMapping = tagMapping;

  if (!effectiveTagMapping && whatsappId) {
    try {
      const preset = await ContactTagImportPreset.findOne({ where: { companyId, whatsappId } });
      if (preset?.mappingJson) {
        const parsed = JSON.parse(preset.mappingJson);
        if (parsed && typeof parsed === "object") {
          effectiveTagMapping = parsed;
        }
      }
    } catch (error: any) {
      logger.warn(`[ImportContactsService] Falha ao carregar preset de tags: ${error?.message}`);
    }
  }

  tagMapping = effectiveTagMapping;
  const options = (tagMapping && tagMapping.__options) ? tagMapping.__options : {};
  const validateNumber = !!options.validateNumber;
  const defaultUnlabeledTagName = typeof options.defaultUnlabeledTagName === 'string' ? options.defaultUnlabeledTagName.trim() : '';
  const progressId: string = options.progressId ? String(options.progressId) : '';
  const dryRun = typeof options.dryRun === 'boolean' ? !!options.dryRun : !!dryRunArg;

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


  // === DEDUPLICAÇÃO NO LOTE ===
  // Agrupar contatos por número canônico para evitar duplicados no mesmo arquivo
  const contactsByNumber = new Map<string, any>();
  const duplicatesInFile: string[] = [];
  
  for (const c of contacts) {
    const number = `${c.number}`.replace(/\D/g, '');
    if (!number) continue;
    
    if (contactsByNumber.has(number)) {
      // Duplicado encontrado - mesclar dados (priorizar mais completo)
      const existing = contactsByNumber.get(number);
      const merged = { ...existing, ...c };
      // Manter nome mais completo
      if (existing.name && existing.name.length > (c.name || '').length) {
        merged.name = existing.name;
      }
      // Manter email se existente tiver
      if (existing.email) merged.email = existing.email;
      // Mesclar deviceTags se houver
      if (existing.deviceTags && c.deviceTags) {
        const tagMap = new Map();
        [...existing.deviceTags, ...c.deviceTags].forEach(t => tagMap.set(t.id, t));
        merged.deviceTags = Array.from(tagMap.values());
      }
      contactsByNumber.set(number, merged);
      duplicatesInFile.push(number);
    } else {
      contactsByNumber.set(number, c);
    }
  }
  
  // Substituir array original pelos contatos deduplicados
  contacts = Array.from(contactsByNumber.values());
  logger.info(`[ImportContactsService] Deduplicados: ${duplicatesInFile.length}, Total final: ${contacts.length}`);

  // === VALIDAÇÕES DE SEGURANÇA ===
  const MAX_CONTACTS_PER_IMPORT = 10000;
  if (contacts.length > MAX_CONTACTS_PER_IMPORT) {
    throw new Error(`Limite de ${MAX_CONTACTS_PER_IMPORT} contatos por importação excedido. Total: ${contacts.length}`);
  }

  const contactList: Contact[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let taggedCount = 0;
  const perTagApplied: Record<string, number> = {};
  const errors: Array<{ row: number; number: string; error: string }> = [];

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

  for (let rowIndex = 0; rowIndex < contacts.length; rowIndex++) {
    const incoming = contacts[rowIndex];
    
    // === TRATAMENTO DE ERROS INDIVIDUAL ===
    try {
      let number = `${incoming.number}`.replace(/\D/g, '');
      
      // Validação básica de número
      if (!number || number.length < 10) {
        throw new Error(`Número inválido ou muito curto: ${incoming.number}`);
      }
      
      // Validação/normalização opcional do número
      if (validateNumber) {
        try {
          const normalized = await CheckContactNumber(number, companyId);
          if (normalized) number = `${normalized}`;
        } catch (e: any) {
          throw new Error(`Falha na validação do número: ${e?.message}`);
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
        if (dryRun) {
          // Simulação: não grava no banco, apenas incrementa contadores
          createdCount++;
          // Representação mínima para permitir uso posterior em dry-run (se necessário)
          contact = ({ ...payload, id: null } as any) as Contact;
        } else {
          contact = await CreateOrUpdateContactServiceForImport({ ...payload, silentMode });
          contactList.push(contact);
          createdCount++;
        }
      } else {
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
          if (dryRun) {
            // Simulação de atualização: não grava, apenas conta
            updatedCount++;
            contact = existing;
          } else {
            contact = await CreateOrUpdateContactServiceForImport({ ...updatePayload, id: existing.id, silentMode });
            updatedCount++;
          }
        } else {
          contact = existing; // Se não houver atualização, mantém o contato existente
          skippedCount++;
        }
      }

      let hasTagAssociation = false;

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
            } else if (mapping.newTagName && !dryRun) {
              // Create new tag (apenas fora do dry-run)
              const [newTag] = await Tag.findOrCreate({
                where: { name: mapping.newTagName, companyId },
                defaults: { color: "#A4CCCC", kanban: 0 }
              });
              systemTagId = newTag.id;
            }

            if (!dryRun && systemTagId) {
              // Associate tag with contact
              await ContactTag.findOrCreate({
                where: { contactId: contact.id, tagId: systemTagId }
              });
              taggedCount++;
              hasTagAssociation = true;
            } else if (dryRun) {
              // Apenas simulação: conta associação prevista
              taggedCount++;
            }

            // Nome da etiqueta para o relatório (tanto para dry-run quanto real)
            let tagNameForReport: string | null = null;
            if (mapping.systemTagId && !dryRun) {
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

        // 2) Aplicar mapeamento especial de "Sem etiqueta" (mesmo sem deviceTags no contato)
        const hasExplicitUnlabeled = !!tagMapping["__unlabeled__"];
        const mapping = hasExplicitUnlabeled ? tagMapping["__unlabeled__"] : (defaultUnlabeledTagName ? { newTagName: defaultUnlabeledTagName } : null);
        if (mapping) {
          let systemTagId = null as any;
          if (mapping.systemTagId) {
            systemTagId = mapping.systemTagId;
          } else if (mapping.newTagName && !dryRun) {
            const [newTag] = await Tag.findOrCreate({
              where: { name: mapping.newTagName, companyId },
              defaults: { color: "#A4CCCC", kanban: 0 }
            });
            systemTagId = newTag.id;
          }
          if (!dryRun && systemTagId) {
            await ContactTag.findOrCreate({ where: { contactId: contact.id, tagId: systemTagId } });
            taggedCount++;
            hasTagAssociation = true;
            const tagNameForReport = mapping.newTagName || (await Tag.findByPk(systemTagId))?.name || "Sem etiqueta";
            perTagApplied[tagNameForReport] = (perTagApplied[tagNameForReport] || 0) + 1;
          } else if (dryRun) {
            // Apenas simulação de associação "Sem etiqueta"
            taggedCount++;
            const tagNameForReport = mapping.newTagName || "Sem etiqueta";
            perTagApplied[tagNameForReport] = (perTagApplied[tagNameForReport] || 0) + 1;
          }
        }
      }

      if (!dryRun && hasTagAssociation && contact && (contact as any).id) {
        try {
          await SyncContactWalletsAndPersonalTagsService({
            companyId: (contact as any).companyId || companyId,
            contactId: (contact as any).id,
            source: "tags"
          });
        } catch (err) {
          logger.warn("[ImportContactsService] Falha ao sincronizar carteiras e tags pessoais", err);
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
      
    } catch (error: any) {
      // Registrar erro individual sem parar a importação
      const errorMessage = error?.message || "Erro desconhecido";
      logger.error(`[ImportContactsService] Erro no contato (linha ${rowIndex + 1}): ${errorMessage}`);
      
      errors.push({
        row: rowIndex + 1,
        number: incoming.number || "N/A",
        error: errorMessage
      });
      
      // Atualiza progresso mesmo com erro
      if (progressId) {
        const p = importProgressMap.get(progressId);
        if (p) {
          p.processed += 1;
          importProgressMap.set(progressId, p);
        }
      }
      
      // Continua para o próximo contato
      continue;
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
    total: contacts.length + duplicatesInFile.length, // Total original antes da deduplicação
    processed: contacts.length, // Total processado após deduplicação
    created: createdCount,
    updated: updatedCount,
    skipped: skippedCount,
    tagged: taggedCount,
    failed: errors,
    duplicatesInFile: duplicatesInFile.length,
    perTagApplied,
    contacts: contactList,
    summary: {
      success: createdCount + updatedCount,
      errors: errors.length,
      duplicates: duplicatesInFile.length,
      executionTime: 0 // será calculado no job
    }
  };

  // Se for importação real com mapeamento de tags e whatsappId definido, persiste preset
  try {
    if (tagMapping && !dryRun && whatsappId) {
      const payload = {
        companyId,
        whatsappId,
        name: tagMapping.__options?.name || "default",
        mappingJson: JSON.stringify(tagMapping),
        lastUsedAt: new Date()
      } as any;

      const [preset] = await ContactTagImportPreset.findOrCreate({
        where: { companyId, whatsappId },
        defaults: payload
      });

      if (preset && !preset.isNewRecord) {
        await preset.update({
          name: payload.name,
          mappingJson: payload.mappingJson,
          lastUsedAt: payload.lastUsedAt
        });
      }
    }
  } catch (e) {
    logger.warn(`[ImportContactsService] Falha ao salvar preset de mapeamento de tags: ${(e as any)?.message}`);
  }

  // Limpa o progresso em memória para este progressId
  if (progressId) {
    try { resetImportProgress(progressId); } catch (_) { /* ignore */ }
  }

  return result;
}
