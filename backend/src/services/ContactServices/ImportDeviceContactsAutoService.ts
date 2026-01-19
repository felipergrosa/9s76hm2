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

    // Buscar todos os contatos existentes de uma vez (mais eficiente)
    const existingContacts = await Contact.findAll({
      where: { companyId },
      attributes: ['number'],
      raw: true
    });

    // Normalizar números existentes para comparação consistente
    existingContacts.forEach(c => {
      const normalizedNumber = String(c.number || '').replace(/\D/g, '');
      existingNumbers.add(normalizedNumber);
    });

    const beforeFilterCount = want.length;
    want = want.filter(c => {
      // Extrair e normalizar número do JID
      const rawNumber = String(c.id || '').split('@')[0];
      const normalizedNumber = rawNumber.replace(/\D/g, '');
      const exists = existingNumbers.has(normalizedNumber);
      return !exists;
    });

    logger.info(`[ImportDeviceContacts] Modo newOnly: ${want.length} contatos novos de ${beforeFilterCount} total (${existingNumbers.size} já existiam no sistema)`);
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
    let contact: Contact | null = null;
    let wasExisting = false;
    let tagApplied = false;

    try {
      const jid = String(c.id || '');
      const number = jid.split('@')[0];

      // Filtrar JIDs especiais que não são contatos válidos
      if (!number) {
        skipped++;
        processed++;
        continue;
      }

      // Ignorar grupos, broadcasts, LIDs e contatos especiais
      const lowerJid = jid.toLowerCase();
      if (lowerJid.includes('@g.us') ||
        lowerJid.includes('@broadcast') ||
        lowerJid.includes('status@broadcast') ||
        lowerJid.includes('@lid') ||
        lowerJid.includes('lid:') ||
        number.length < 8) { // Números muito curtos não são válidos
        logger.debug(`[ImportDeviceContactsAutoService] Ignorando JID especial: ${jid}`);
        skipped++;
        processed++;
        continue;
      }

      // Primeiro, buscar se já existe
      contact = await Contact.findOne({ where: { number, companyId } });
      wasExisting = !!contact;

      if (!contact) {
        // Tentar criar novo contato
        try {
          contact = await Contact.create({
            number,
            name: (c.name || c.notify || number),
            email: '',
            companyId,
            whatsappId
          } as any);
          created++;
        } catch (createError: any) {
          if (createError.name === 'SequelizeUniqueConstraintError') {
            // Race condition: contato foi criado entre o findOne e o create
            contact = await Contact.findOne({ where: { number, companyId } });
            wasExisting = true;
            if (!contact) {
              // Contato realmente não pode ser recuperado
              failed++;
              processed++;
              continue;
            }
          } else {
            throw createError;
          }
        }
      }

      // A partir daqui, contact está garantido
      if (contact) {
        // Atualizar nome e whatsappId se necessário
        const currentName = (contact.name || '').trim();
        const isNumberName = currentName.replace(/\D/g, '') === number;
        const incomingName = (c.name || c.notify || '').trim();
        const shouldUpdateName = (!currentName || isNumberName) && incomingName;
        const shouldUpdateWhatsapp = whatsappId && !contact.whatsappId;

        if (shouldUpdateName || shouldUpdateWhatsapp) {
          const updateData: any = {};
          if (shouldUpdateName) updateData.name = incomingName;
          if (shouldUpdateWhatsapp) updateData.whatsappId = whatsappId;
          await contact.update(updateData);
          if (!wasExisting) updated++;
        }

        // Aplicar tags do dispositivo
        const tags = Array.isArray(c.tags) ? c.tags : [];
        for (const t of tags) {
          const tagName = (t?.name || '').toString().trim();
          if (!tagName) continue;

          let tagRow: Tag | null = await Tag.findOne({ where: { name: tagName, companyId } });
          if (!tagRow && autoCreateTags) {
            tagRow = await Tag.create({ name: tagName, color: '#A4CCCC', kanban: 0, companyId } as any);
          }

          if (tagRow) {
            await ContactTag.findOrCreate({ where: { contactId: contact.id, tagId: tagRow.id } });
            tagged++;
            tagApplied = true;
          }
        }

        // Aplicar tag alvo
        if (targetTagId) {
          try {
            await ContactTag.findOrCreate({ where: { contactId: contact.id, tagId: targetTagId } });
            tagged++;
            tagApplied = true;
          } catch (tagError) {
            // Ignora erro de tag duplicada, ainda é sucesso
            logger.warn(`[ImportDeviceContacts] Erro ao aplicar tag ${targetTagId} ao contato ${contact.id}: ${tagError}`);
          }
        }

        // Contar como duplicado se já existia
        if (wasExisting) {
          duplicated++;
        }

        // Sincronizar carteiras se teve tags
        if (tags.length > 0 || tagApplied) {
          try {
            await SyncContactWalletsAndPersonalTagsService({
              companyId,
              contactId: contact.id,
              source: "tags"
            });
          } catch (err) {
            // Não falha a importação por causa de sync de carteiras
          }
        }
      }
    } catch (e: any) {
      // Distinguir tipos de erro para melhor diagnóstico
      const errorMessage = e?.message || String(e);
      const number = String(c?.id || '').split('@')[0];

      if (e?.name === 'SequelizeUniqueConstraintError') {
        // Contato duplicado - não contar como falha real
        logger.info(`[ImportDeviceContactsAutoService] Contato duplicado ignorado: ${number}`);
        duplicated++;
      } else if (errorMessage.includes('validation') || errorMessage.includes('constraint')) {
        logger.warn(`[ImportDeviceContactsAutoService] Erro de validação para ${number}: ${errorMessage}`);
        failed++;
      } else {
        logger.error(`[ImportDeviceContactsAutoService] Erro ao importar contato ${c?.id} (${number}): ${errorMessage}`);
        failed++;
      }
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

