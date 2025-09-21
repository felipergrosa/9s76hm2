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
