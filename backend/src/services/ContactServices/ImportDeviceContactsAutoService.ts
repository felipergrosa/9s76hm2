import Contact from "../../models/Contact";
import Tag from "../../models/Tag";
import ContactTag from "../../models/ContactTag";
import GetDeviceContactsService from "../WbotServices/GetDeviceContactsService";
import logger from "../../utils/logger";
import SyncContactWalletsAndPersonalTagsService from "./SyncContactWalletsAndPersonalTagsService";

interface Params {
  companyId: number;
  whatsappId?: number;
  selectedJids?: string[];
  autoCreateTags?: boolean;
  targetTagId?: number;
}

const ImportDeviceContactsAutoService = async ({ companyId, whatsappId, selectedJids, autoCreateTags = true, targetTagId }: Params) => {
  const deviceContacts = await GetDeviceContactsService(companyId, whatsappId);

  const want = Array.isArray(selectedJids) && selectedJids.length > 0
    ? deviceContacts.filter(c => selectedJids.includes(c.id))
    : deviceContacts;

  let created = 0;
  let updated = 0;
  let tagged = 0;
  let failed = 0;

  for (const c of want) {
    try {
      const number = String(c.id || '').split('@')[0];
      if (!number) continue;

      let contact = await Contact.findOne({ where: { number, companyId } });
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
          // Se falhar por constraint unique, tenta buscar novamente (race condition ou registro existente)
          if (error.name === 'SequelizeUniqueConstraintError') {
            contact = await Contact.findOne({ where: { number, companyId } });
          }

          // Se ainda assim não encontrou, relança o erro
          if (!contact) {
            throw error;
          }
        }
      }

      // Se tivermos o contato (recuperado ou criado), verificamos atualização
      if (contact) {
        // Atualiza nome apenas se atual vazio/igual ao número; senão, preserva nome curado
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

      // Adicionar tag alvo selecionada manualmente
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
  }

  return { count: want.length, created, updated, tagged, failed };
};

export default ImportDeviceContactsAutoService;
