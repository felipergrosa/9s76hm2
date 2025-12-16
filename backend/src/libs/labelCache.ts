import logger from "../utils/logger";

export interface DeviceLabel {
  id: string;
  name: string;
  color?: any;
  predefinedId?: string;
}

// whatsappId -> (labelId -> label)
const labelsByWpp = new Map<number, Map<string, DeviceLabel>>();
// whatsappId -> (chatId -> Set<labelId>)
const chatLabelsByWpp = new Map<number, Map<string, Set<string>>>();

export const upsertLabel = (whatsappId: number, label: DeviceLabel & { deleted?: boolean }) => {
  let map = labelsByWpp.get(whatsappId);
  if (!map) {
    map = new Map();
    labelsByWpp.set(whatsappId, map);
  }
  if (label && !label.deleted) {
    map.set(String(label.id), { id: String(label.id), name: label.name, color: label.color, predefinedId: label.predefinedId });
    logger.info(`[labelCache] upsertLabel: ${label.name} (${label.id}) for whatsappId=${whatsappId}`);
  } else if (label && label.deleted) {
    map.delete(String(label.id));
    logger.info(`[labelCache] deleteLabel: ${label.name} (${label.id}) for whatsappId=${whatsappId}`);
  }
};

export const addChatLabelAssociation = (whatsappId: number, chatId: string, labelId: string, labeled: boolean) => {
  let map = chatLabelsByWpp.get(whatsappId);
  if (!map) {
    map = new Map();
    chatLabelsByWpp.set(whatsappId, map);
  }
  const key = String(chatId);
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  const lid = String(labelId);
  if (labeled) {
    set.add(lid);
  } else {
    set.delete(lid);
  }
  logger.info(`[labelCache] association ${labeled ? 'add' : 'remove'}: chat=${chatId} label=${labelId} whatsappId=${whatsappId}`);
};

export const getLabels = (whatsappId: number): DeviceLabel[] => {
  const map = labelsByWpp.get(whatsappId);
  return map ? Array.from(map.values()) : [];
};

export const getLabelMap = (whatsappId: number): Map<string, DeviceLabel> => {
  return labelsByWpp.get(whatsappId) || new Map();
};

export const getChatLabelIds = (whatsappId: number, chatId: string): string[] => {
  const map = chatLabelsByWpp.get(whatsappId);
  const set = map?.get(String(chatId));
  return set ? Array.from(set) : [];
};

export const getAllChatLabels = (whatsappId: number): Map<string, Set<string>> => {
  return chatLabelsByWpp.get(whatsappId) || new Map();
};

export const mapLabelIdsToTags = (whatsappId: number, labelIds: string[]): { id: string; name: string; color?: any }[] => {
  const lmap = getLabelMap(whatsappId);
  return labelIds.map(id => {
    const lab = lmap.get(String(id));
    return { id: String(id), name: lab?.name || String(id), color: lab?.color };
  });
};

export const clearCache = (whatsappId: number) => {
  labelsByWpp.delete(whatsappId);
  chatLabelsByWpp.delete(whatsappId);
  logger.info(`[labelCache] Cache limpo para whatsappId=${whatsappId}`);
};

/**
 * Carrega labels do banco de dados para o cache em memória.
 * Útil para recuperar labels após reiniciar o backend.
 * 
 * @param whatsappId - ID da conexão WhatsApp
 * @returns Quantidade de labels carregadas
 */
export const loadLabelsFromDatabase = async (whatsappId: number): Promise<number> => {
  try {
    // Import dinâmico para evitar dependência circular
    const WhatsappLabel = (await import("../models/WhatsappLabel")).default;
    
    const dbLabels = await WhatsappLabel.findAll({
      where: { whatsappId, deleted: false }
    });
    
    if (!dbLabels || dbLabels.length === 0) {
      logger.info(`[labelCache] Nenhuma label encontrada no banco para whatsappId=${whatsappId}`);
      return 0;
    }
    
    // Limpar cache atual antes de popular
    let map = labelsByWpp.get(whatsappId);
    if (!map) {
      map = new Map();
      labelsByWpp.set(whatsappId, map);
    }
    
    for (const label of dbLabels) {
      map.set(String(label.whatsappLabelId), {
        id: String(label.whatsappLabelId),
        name: label.name,
        color: label.color,
        predefinedId: label.predefinedId
      });
    }
    
    logger.info(`[labelCache] Carregadas ${dbLabels.length} labels do banco para whatsappId=${whatsappId}`);
    return dbLabels.length;
  } catch (err: any) {
    logger.error(`[labelCache] Erro ao carregar labels do banco: ${err?.message}`);
    return 0;
  }
};

/**
 * Carrega associações chat-label do banco de dados para o cache.
 * 
 * @param whatsappId - ID da conexão WhatsApp
 * @returns Quantidade de associações carregadas
 */
export const loadChatLabelsFromDatabase = async (whatsappId: number): Promise<number> => {
  try {
    // Import dinâmico para evitar dependência circular
    const WhatsappLabel = (await import("../models/WhatsappLabel")).default;
    const ContactWhatsappLabel = (await import("../models/ContactWhatsappLabel")).default;
    const Contact = (await import("../models/Contact")).default;
    const Whatsapp = (await import("../models/Whatsapp")).default;
    
    // Buscar companyId do whatsapp
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      logger.warn(`[labelCache] WhatsApp ${whatsappId} não encontrado`);
      return 0;
    }
    
    // Buscar todas as labels desta conexão
    const dbLabels = await WhatsappLabel.findAll({
      where: { whatsappId, deleted: false },
      include: [{
        model: ContactWhatsappLabel,
        as: 'contactLabels',
        include: [{
          model: Contact,
          as: 'contact',
          where: { companyId: whatsapp.companyId },
          required: true
        }]
      }]
    });
    
    let count = 0;
    let map = chatLabelsByWpp.get(whatsappId);
    if (!map) {
      map = new Map();
      chatLabelsByWpp.set(whatsappId, map);
    }
    
    for (const label of dbLabels) {
      const contactLabels = (label as any).contactLabels || [];
      for (const cl of contactLabels) {
        const contact = cl.contact;
        if (contact?.number) {
          const chatId = `${contact.number}@c.us`;
          let set = map.get(chatId);
          if (!set) {
            set = new Set();
            map.set(chatId, set);
          }
          set.add(String(label.whatsappLabelId));
          count++;
        }
      }
    }
    
    logger.info(`[labelCache] Carregadas ${count} associações chat-label do banco para whatsappId=${whatsappId}`);
    return count;
  } catch (err: any) {
    logger.error(`[labelCache] Erro ao carregar associações do banco: ${err?.message}`);
    return 0;
  }
};
