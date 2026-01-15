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

      // Se modo newOnly e contato existe, pular
      if (importMode === "newOnly" && contact) {
        skipped++;
        processed++;
        continue;
      }

      if (!contact) {
        try {
          contact = await Contact.create({
            number,
            name: (c.name || c.notify || number),
            email: '',
            companyId
          } as any);
          created++;
        } catch (error: any) {
          if (error.name === 'SequelizeUniqueConstraintError') {
            contact = await Contact.findOne({ where: { number, companyId } });
          }
          if (!contact) {
            throw error;
          }
        }
      }

      if (contact) {
        const currentName = (contact.name || '').trim();
        const isNumberName = currentName.replace(/\D/g, '') === number;
        const incomingName = (c.name || c.notify || '').trim();
        if ((!currentName || isNumberName) && incomingName) {
          await contact.update({ name: incomingName });
          updated++;
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

  return { count: want.length, created, updated, tagged, failed, skipped };
};

export default ImportDeviceContactsAutoService;

