import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import ShowBaileysService from "../BaileysServices/ShowBaileysService";
import logger from "../../utils/logger";
import { isString, isArray } from "lodash";
import { getLabelMap, getLabels, getAllChatLabels } from "../../libs/labelCache";
import { getUnlabeledJids } from "./GetDeviceContactsService";

interface DeviceTag {
  id: string;
  name: string;
  color?: string;
  count?: number;
}

const GetDeviceTagsService = async (
  companyId: number, 
  whatsappId?: number,
  forceRefresh: boolean = false
): Promise<DeviceTag[]> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(whatsappId, companyId);

  try {
    logger.info(`[GetDeviceTagsService] Buscando tags para company=${companyId}, whatsappId=${defaultWhatsapp.id}, forceRefresh=${forceRefresh}`);

    // Se forceRefresh, limpar cache antes de buscar
    if (forceRefresh) {
      const { clearCache } = require("../../libs/labelCache");
      clearCache(defaultWhatsapp.id);
      logger.info(`[GetDeviceTagsService] Cache limpo devido a forceRefresh`);
    }

    const tagsMap = new Map<string, DeviceTag>();

    // 1) PRIMEIRA FONTE: CACHE DE LABELS (labelCache)
    const cachedLabels = getLabels(defaultWhatsapp.id);
    logger.info(`[GetDeviceTagsService] Labels em cache: ${cachedLabels.length}`);

    if (cachedLabels.length > 0) {
      const chatLabels = getAllChatLabels(defaultWhatsapp.id);
      const countByLabel = new Map<string, number>();

      for (const [, set] of chatLabels.entries()) {
        for (const labelId of set.values()) {
          const key = String(labelId);
          countByLabel.set(key, (countByLabel.get(key) || 0) + 1);
        }
      }

      cachedLabels.forEach(label => {
        const id = String(label.id);
        tagsMap.set(id, {
          id,
          name: label.name,
          color: (label as any).color,
          count: countByLabel.get(id) || 0
        });
      });

      logger.info(`[GetDeviceTagsService] Usando ${tagsMap.size} tags a partir do cache de labels`);
    } else {
      // 2) FALLBACK: DADOS PERSISTIDOS DO BAILEYS (contatos e chats)
      const baileysData = await ShowBaileysService(defaultWhatsapp.id);
      logger.info(`[GetDeviceTagsService] BaileysData encontrado: ${!!baileysData}`);

      const parseMaybeJSON = (val: any) => {
        try {
          if (!val) return null;
          if (isString(val)) return JSON.parse(val as string);
          return val;
        } catch {
          return null;
        }
      };

      const contacts = parseMaybeJSON((baileysData as any).contacts);
      const chats = parseMaybeJSON((baileysData as any).chats);
      const labelMap = getLabelMap(defaultWhatsapp.id);

      logger.info(`[GetDeviceTagsService] Contacts parsed: ${contacts ? 'sim' : 'não'}, length: ${contacts ? contacts.length : 0}`);
      logger.info(`[GetDeviceTagsService] Chats parsed: ${chats ? 'sim' : 'não'}, length: ${chats ? chats.length : 0}`);

      // Extrair tags/labels únicas a partir dos CHATS
      if (isArray(chats)) {
        logger.info(`[GetDeviceTagsService] Processando ${chats.length} chats (fallback)`);
        (chats as any[]).forEach((chat: any, index: number) => {
          const labels: any[] = Array.isArray(chat?.labels) ? chat.labels : [];
          const chatLabels = chat?.chatLabels || chat?.labelIds || [];
          const allLabels = [...labels, ...chatLabels];

          if (allLabels.length > 0) {
            logger.info(`[GetDeviceTagsService] Chat ${index} tem ${allLabels.length} labels (fallback)`);
          }

          allLabels.forEach((label: any) => {
            const rawId = label?.id || label?.tagId || label?.labelId || label?.value || label;
            const id = String(rawId);
            if (!id) return;

            const fromCache = labelMap.get(id);
            const tagName = fromCache?.name || label?.name || label?.label || label?.title || label?.displayName || (isString(label) ? label : undefined);
            const tagColor = fromCache?.color || label?.color || label?.colorHex || label?.backgroundColor || "#A4CCCC";

            const finalName = tagName ? String(tagName) : id;
            if (!tagsMap.has(id)) {
              tagsMap.set(id, {
                id,
                name: finalName,
                color: tagColor
              });
            }
          });
        });
      }

      // Fallback adicional: tentar extrair de contacts caso exista estrutura 'tags'
      if (tagsMap.size === 0 && isArray(contacts)) {
        (contacts as any[]).forEach((contact: any) => {
          if (contact?.tags && Array.isArray(contact.tags)) {
            contact.tags.forEach((tag: any) => {
              const tagId = tag?.id || tag?.tagId || tag?.value || tag;
              const tagName = tag?.name || tag?.label || tag;

              if (tagName) {
                const id = String(tagId || tagName);
                if (!tagsMap.has(id)) {
                  tagsMap.set(id, {
                    id,
                    name: String(tagName),
                    color: (tag && tag.color) || "#A4CCCC"
                  });
                }
              }
            });
          }
        });
      }
    }

    // Adicionar tag sintética "Sem etiqueta" com contagem de JIDs sem labels
    try {
      const unlabeled = await getUnlabeledJids(companyId, whatsappId);
      const countUnlabeled = unlabeled.size;
      logger.info(`[GetDeviceTagsService] Contatos sem etiqueta encontrados: ${countUnlabeled}`);
      
      // Sempre adicionar, mesmo com count 0 (para debug)
      tagsMap.set("__unlabeled__", {
        id: "__unlabeled__",
        name: "Sem etiqueta",
        color: "#8D99AE",
        count: countUnlabeled
      });
    } catch (err: any) {
      logger.warn(`[GetDeviceTagsService] Erro ao buscar contatos sem etiqueta: ${err?.message}`);
    }

    // Enriquecer contagem por tag com base nos dados (cache e Baileys)
    try {
      const defaultWhatsappId = defaultWhatsapp.id;
      const baileysData = await ShowBaileysService(defaultWhatsappId);
      const parseMaybeJSON = (val: any) => {
        try { if (!val) return null; if (isString(val)) return JSON.parse(val as string); return val; } catch { return null; }
      };
      const chats = parseMaybeJSON((baileysData as any).chats);
      // Mapa de contagem
      const counts = new Map<string, number>();
      if (isArray(chats)) {
        (chats as any[]).forEach((chat: any) => {
          const raw = Array.isArray(chat?.labels) ? chat.labels : (Array.isArray(chat?.labelIds) ? chat.labelIds : []);
          for (const item of (raw || [])) {
            const id = String(typeof item === 'object' ? (item?.id ?? item?.value ?? item) : item);
            counts.set(id, (counts.get(id) || 0) + 1);
          }
        });
      }
      // Aplicar contagem nas tags
      for (const [id, obj] of tagsMap.entries()) {
        if (id === "__unlabeled__") continue; // já setada acima
        const c = counts.get(id) || 0;
        (obj as any).count = c;
        tagsMap.set(id, obj as any);
      }
    } catch {}

    const deviceTags = Array.from(tagsMap.values());
    
    // Não retornar mais etiquetas mockadas: se não houver, retornar vazio para o frontend lidar corretamente
    if (deviceTags.length === 0) {
      logger.info(`[GetDeviceTagsService] Nenhuma tag encontrada nos dados persistidos do Baileys`);
      return [];
    }
    
    logger.info(
      `Found ${deviceTags.length} device labels for company=${companyId} whatsappId=${defaultWhatsapp.id}`
    );
    return deviceTags;
  } catch (error) {
    logger.warn(`Could not get device tags. Err: ${error}`);
    return [];
  }
};

export default GetDeviceTagsService;
