import { getLabels, getAllChatLabels, getLabelMap } from "../../libs/labelCache";
import WhatsappLabel from "../../models/WhatsappLabel";
import ContactWhatsappLabel from "../../models/ContactWhatsappLabel";
import Contact from "../../models/Contact";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import logger from "../../utils/logger";

interface LabelStats {
  id: string;
  name: string;
  color: number;
  dbContactCount: number;
  whatsappContactCount: number;
  canImport: boolean;
  predefinedId?: string;
}

class WhatsAppLabelsService {
  /**
   * Sincroniza labels do cache (App State) para o banco de dados
   */
  static async syncLabelsToDatabase(companyId: number, whatsappId?: number): Promise<void> {
    const defaultWhatsapp = await GetDefaultWhatsApp(whatsappId, companyId);
    const cacheLabels = getLabels(defaultWhatsapp.id);
    
    logger.info(`[WhatsAppLabelsService] Sincronizando ${cacheLabels.length} labels para o banco`);

    for (const label of cacheLabels) {
      await WhatsappLabel.findOrCreate({
        where: {
          whatsappLabelId: label.id,
          whatsappId: defaultWhatsapp.id
        },
        defaults: {
          whatsappLabelId: label.id,
          name: label.name,
          color: label.color || 0,
          predefinedId: label.predefinedId,
          deleted: false,
          whatsappId: defaultWhatsapp.id
        }
      });
    }
  }

  /**
   * Obtém estatísticas das labels (cache vs banco)
   */
  static async getLabelsStats(companyId: number, whatsappId?: number): Promise<LabelStats[]> {
    const defaultWhatsapp = await GetDefaultWhatsApp(whatsappId, companyId);
    const cacheLabels = getLabels(defaultWhatsapp.id);
    const chatLabelsMap = getAllChatLabels(defaultWhatsapp.id);
    
    const stats: LabelStats[] = [];

    for (const label of cacheLabels) {
      // Contar contatos no WhatsApp (via cache)
      let whatsappContactCount = 0;
      for (const [chatId, labelIds] of chatLabelsMap.entries()) {
        if (labelIds.has(label.id) && !chatId.endsWith('@g.us')) {
          whatsappContactCount++;
        }
      }

      // Contar contatos no banco
      const dbLabel = await WhatsappLabel.findOne({
        where: { whatsappLabelId: label.id, whatsappId: defaultWhatsapp.id },
        include: [{ model: ContactWhatsappLabel }]
      });

      const dbContactCount = dbLabel?.contactLabels?.length || 0;

      stats.push({
        id: label.id,
        name: label.name,
        color: label.color || 0,
        dbContactCount,
        whatsappContactCount,
        canImport: whatsappContactCount > dbContactCount,
        predefinedId: label.predefinedId
      });
    }

    return stats;
  }

  /**
   * Importa contatos de uma label específica
   */
  static async importContactsByLabel(
    companyId: number, 
    labelId: string, 
    whatsappId?: number
  ): Promise<{ imported: number; skipped: number }> {
    const defaultWhatsapp = await GetDefaultWhatsApp(whatsappId, companyId);
    const chatLabelsMap = getAllChatLabels(defaultWhatsapp.id);
    const labelMap = getLabelMap(defaultWhatsapp.id);
    
    const label = labelMap.get(labelId);
    if (!label) {
      throw new Error(`Label ${labelId} não encontrada no cache`);
    }

    // Garantir que a label existe no banco
    const [dbLabel] = await WhatsappLabel.findOrCreate({
      where: { whatsappLabelId: labelId, whatsappId: defaultWhatsapp.id },
      defaults: {
        whatsappLabelId: labelId,
        name: label.name,
        color: label.color || 0,
        predefinedId: label.predefinedId,
        deleted: false,
        whatsappId: defaultWhatsapp.id
      }
    });

    let imported = 0;
    let skipped = 0;

    // Encontrar chats com esta label
    for (const [chatId, labelIds] of chatLabelsMap.entries()) {
      if (labelIds.has(labelId) && !chatId.endsWith('@g.us')) {
        const number = chatId.split('@')[0];
        
        // Buscar ou criar contato
        const [contact] = await Contact.findOrCreate({
          where: { number, companyId },
          defaults: {
            name: number,
            number,
            companyId,
            isGroup: false
          }
        });

        // Associar label ao contato
        const [association, created] = await ContactWhatsappLabel.findOrCreate({
          where: {
            contactId: contact.id,
            whatsappLabelId: dbLabel.id
          }
        });

        if (created) {
          imported++;
        } else {
          skipped++;
        }
      }
    }

    logger.info(`[WhatsAppLabelsService] Label ${label.name}: ${imported} importados, ${skipped} já existiam`);
    return { imported, skipped };
  }

  /**
   * Adiciona label a um contato via WhatsApp
   */
  static async addLabelToContact(
    companyId: number,
    contactNumber: string,
    labelId: string,
    whatsappId?: number
  ): Promise<void> {
    const defaultWhatsapp = await GetDefaultWhatsApp(whatsappId, companyId);
    const wbot = getWbot(defaultWhatsapp.id) as any;
    
    if (!wbot || typeof wbot.addChatLabel !== 'function') {
      throw new Error("Função addChatLabel não disponível no socket atual");
    }

    const chatId = `${contactNumber}@c.us`;
    await wbot.addChatLabel(chatId, labelId);
    
    logger.info(`[WhatsAppLabelsService] Label ${labelId} adicionada ao contato ${contactNumber}`);
  }

  /**
   * Remove label de um contato via WhatsApp
   */
  static async removeLabelFromContact(
    companyId: number,
    contactNumber: string,
    labelId: string,
    whatsappId?: number
  ): Promise<void> {
    const defaultWhatsapp = await GetDefaultWhatsApp(whatsappId, companyId);
    const wbot = getWbot(defaultWhatsapp.id) as any;
    
    if (!wbot || typeof wbot.removeChatLabel !== 'function') {
      throw new Error("Função removeChatLabel não disponível no socket atual");
    }

    const chatId = `${contactNumber}@c.us`;
    await wbot.removeChatLabel(chatId, labelId);
    
    logger.info(`[WhatsAppLabelsService] Label ${labelId} removida do contato ${contactNumber}`);
  }

  /**
   * Cria nova label via WhatsApp
   */
  static async createLabel(
    companyId: number,
    name: string,
    color: number = 0,
    whatsappId?: number
  ): Promise<string> {
    const defaultWhatsapp = await GetDefaultWhatsApp(whatsappId, companyId);
    const wbot = getWbot(defaultWhatsapp.id) as any;
    
    if (!wbot || typeof wbot.addLabel !== 'function') {
      throw new Error("Função addLabel não disponível no socket atual");
    }

    const labelId = `label_${Date.now()}`;
    await wbot.addLabel('', {
      id: labelId,
      name,
      color
    });
    
    logger.info(`[WhatsAppLabelsService] Label ${name} criada com ID ${labelId}`);
    return labelId;
  }
}

export default WhatsAppLabelsService;
