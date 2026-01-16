import Contact from "../../models/Contact";
import Tag from "../../models/Tag";
import ContactTag from "../../models/ContactTag";
import GetDeviceContactsService from "../WbotServices/GetDeviceContactsService";
import logger from "../../utils/logger";
import SyncContactWalletsAndPersonalTagsService from "./SyncContactWalletsAndPersonalTagsService";
import { getIO } from "../../libs/socket";

interface Params {
  companyId: number;
  whatsappId?: number;
  selectedJids?: string[];
  autoCreateTags?: boolean;
  targetTagId?: number;
  importMode?: "all" | "newOnly" | "manual";
}

const ImportDeviceContactsAutoService = async ({
  companyId,
  whatsappId,
  selectedJids,
  autoCreateTags = true,
  targetTagId,
  importMode = "manual"
}: Params) => {
  const io = getIO();
  const deviceContacts = await GetDeviceContactsService(companyId, whatsappId);

  // Determinar quais contatos processar baseado no modo
  let want = Array.isArray(selectedJids) && selectedJids.length > 0
    ? deviceContacts.filter(c => selectedJids.includes(c.id))
    : deviceContacts;

  // Se modo "newOnly", filtrar apenas contatos que não existem no sistema
  if (importMode === "newOnly") {
    const existingNumbers = new Set<string>();
    const allNumbers = want.map(c => String(c.id || '').split('@')[0]).filter(Boolean);

    // Buscar todos os contatos existentes de uma vez (mais eficiente)
    const existingContacts = await Contact.findAll({
      where: { companyId },
      attributes: ['number'],
      raw: true
    });
    existingContacts.forEach(c => existingNumbers.add(c.number));

    want = want.filter(c => {
      const number = String(c.id || '').split('@')[0];
      return !existingNumbers.has(number);
    });

    logger.info(`[ImportDeviceContacts] Modo newOnly: ${want.length} contatos novos de ${allNumbers.length} total`);
  }

  let created = 0;
  let updated = 0;
  let tagged = 0;
  let failed = 0;
  let skipped = 0;
  let duplicated = 0; // Contatos que já existiam mas receberam tags
  const total = want.length;

  // Emitir progresso inicial
  io.to(`company-${companyId}-mainchannel`).emit(`importContacts-${companyId}`, {
    action: "progress",
    total,
    processed: 0,
    created: 0,
    updated: 0,
    tagged: 0,
    skipped: 0
  });

  let processed = 0;
  for (const c of want) {
    try {
      const number = String(c.id || '').split('@')[0];
      if (!number) {
        skipped++;
        processed++;
        continue;
      }

      let contact = await Contact.findOne({ where: { number, companyId } });
      let wasExisting = !!contact;

      if (!contact) {
        try {
          contact = await Contact.create({
            number,
            name: (c.name || c.notify || number),
            email: '',
            companyId,
            whatsappId // Associar à conexão usada na importação
          } as any);
          created++;
        } catch (error: any) {
          if (error.name === 'SequelizeUniqueConstraintError') {
            // Contato já existe - buscar e continuar para aplicar tags
            contact = await Contact.findOne({ where: { number, companyId } });
            if (contact) {
              wasExisting = true;
              logger.info(`[ImportDeviceContacts] Contato ${number} já existe, recuperado para aplicar tags`);
            }
          }
          if (!contact) {
            throw error;
          }
        }
      }


      if (contact) {
        // Contar como duplicado se já existia e recebeu tag
        if (wasExisting && targetTagId) {
          duplicated++;
        }

        const currentName = (contact.name || '').trim();
        const isNumberName = currentName.replace(/\D/g, '') === number;
        const incomingName = (c.name || c.notify || '').trim();

        // Atualizar nome se estiver vazio ou igual ao número
        const shouldUpdateName = (!currentName || isNumberName) && incomingName;
        // Atualizar whatsappId se não estiver definido
        const shouldUpdateWhatsapp = whatsappId && !contact.whatsappId;

        if (shouldUpdateName || shouldUpdateWhatsapp) {
          const updateData: any = {};
          if (shouldUpdateName) updateData.name = incomingName;
          if (shouldUpdateWhatsapp) updateData.whatsappId = whatsappId;
          await contact.update(updateData);
          if (shouldUpdateName || shouldUpdateWhatsapp) updated++;
        }
      }

      const tags = Array.isArray(c.tags) ? c.tags : [];
      for (const t of tags) {
        const tagName = (t?.name || '').toString().trim();
        if (!tagName) continue;

        let tagRow: Tag | null = null;
        tagRow = await Tag.findOne({ where: { name: tagName, companyId } });
        if (!tagRow && autoCreateTags) {
          tagRow = await Tag.create({ name: tagName, color: '#A4CCCC', kanban: 0, companyId } as any);
        }

        if (tagRow) {
          await ContactTag.findOrCreate({ where: { contactId: contact.id, tagId: tagRow.id } });
          tagged++;
        }
      }

      if (targetTagId) {
        await ContactTag.findOrCreate({ where: { contactId: contact.id, tagId: targetTagId } });
        tagged++;
      }

      if (tags.length > 0) {
        try {
          await SyncContactWalletsAndPersonalTagsService({
            companyId,
            contactId: contact.id,
            source: "tags"
          });
        } catch (err) {
          logger.warn("[ImportDeviceContactsAutoService] Falha ao sincronizar carteiras e tags pessoais", err);
        }
      }
    } catch (e) {
      logger.warn(`[ImportDeviceContactsAutoService] Falha ao importar/etiquetar contato ${c?.id}: ${e}`);
      failed++;
    }

    processed++;

    // Emitir progresso a cada 10 contatos ou no final
    if (processed % 10 === 0 || processed === total) {
      io.to(`company-${companyId}-mainchannel`).emit(`importContacts-${companyId}`, {
        action: "progress",
        total,
        processed,
        created,
        updated,
        tagged,
        skipped
      });
    }
  }

  // Emitir conclusão
  io.to(`company-${companyId}-mainchannel`).emit(`importContacts-${companyId}`, {
    action: "complete",
    total,
    processed,
    created,
    updated,
    tagged,
    skipped,
    failed
  });

  return { count: want.length, created, updated, tagged, failed, skipped, duplicated };
};

export default ImportDeviceContactsAutoService;

