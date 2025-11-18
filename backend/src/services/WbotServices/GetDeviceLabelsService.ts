import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import logger from "../../utils/logger";
import { getLabels, getAllChatLabels } from "../../libs/labelCache";
import ShowBaileysService from "../BaileysServices/ShowBaileysService";
import { getWbot } from "../../libs/wbot";

interface DeviceLabel {
  id: string;
  name: string;
  color?: string;
  count?: number;
}

const GetDeviceLabelsService = async (companyId: number, whatsappId?: number): Promise<DeviceLabel[]> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(whatsappId, companyId);

  try {
    logger.info(`[GetDeviceLabelsService] Buscando labels (cache AppState/BinaryInfo) para company=${companyId}, whatsappId=${defaultWhatsapp.id}`);
    // As labels são sincronizadas via App State patches (labelEditAction), decodificadas pelo Baileys
    // e emitidas no evento 'labels.edit'. O wbotMonitor capta estes eventos e preenche o cache em memória.
    let labels = getLabels(defaultWhatsapp.id);
    logger.info(`[GetDeviceLabelsService] Labels no cache: ${labels.length}`);

    // DESABILITADO: resyncAppState pode causar device_removed
    // Em vez de forçar resync, retornar labels vazio e esperar sincronização natural
    if (labels.length === 0) {
      logger.warn(`[GetDeviceLabelsService] Cache vazio para whatsappId=${defaultWhatsapp.id}. NÃO forçando resync (pode causar device_removed). Aguardando sincronização natural.`);
      // Não forçar resync - pode causar device_removed
      // O Baileys sincronizará naturalmente através dos eventos labels.edit
    }

    if (labels.length === 0) {
      logger.info(`[GetDeviceLabelsService] Nenhuma label encontrada mesmo após resync, retornando array vazio`);
      return [];
    }

    // Construir mapa de contagem por label usando associações chat->labels do cache
    const chatLabels = getAllChatLabels(defaultWhatsapp.id);
    const countByLabel = new Map<string, number>();
    for (const [, set] of chatLabels.entries()) {
      for (const labelId of set.values()) {
        const key = String(labelId);
        countByLabel.set(key, (countByLabel.get(key) || 0) + 1);
      }
    }

    // Fallback: se o cache não tiver associações, contar pelos CHATS persistidos (Baileys)
    const totalFromCache = Array.from(countByLabel.values()).reduce((a, b) => a + b, 0);
    if (totalFromCache === 0) {
      try {
        const baileysData = await ShowBaileysService(defaultWhatsapp.id);
        const parseMaybeJSON = (val: any) => {
          try {
            if (!val) return null;
            if (typeof val === 'string') return JSON.parse(val);
            return val;
          } catch {
            return null;
          }
        };
        const chats = parseMaybeJSON((baileysData as any).chats);
        if (Array.isArray(chats)) {
          for (const chat of chats) {
            const labels: any[] = Array.isArray(chat?.labels) ? chat.labels : [];
            for (const lid of labels) {
              const key = String(lid);
              countByLabel.set(key, (countByLabel.get(key) || 0) + 1);
            }
          }
        }
      } catch (e) {
        logger.warn(`[GetDeviceLabelsService] Fallback de contagem por Baileys falhou: ${e}`);
      }
    }

    const mapWaColorToHex = (c: any): string => {
      if (!c) return "#A4CCCC";
      if (typeof c === 'string') {
        // Se já vier como HEX/CSS, usa diretamente
        if (c.startsWith('#') || c.startsWith('rgb')) return c;
        // Strings numéricas
        const n = Number(c);
        if (!isNaN(n)) c = n;
      }
      if (typeof c === 'number') {
        const palette = [
          "#A4CCCC", // 0 default
          "#5EC2B7", // 1 teal
          "#6EC1E4", // 2 blue
          "#F6C85F", // 3 amber
          "#EC7D7D", // 4 red
          "#BC85F8", // 5 purple
          "#69DB7C", // 6 green
          "#FFD166", // 7 yellow
          "#118AB2", // 8 deep blue
          "#8D99AE", // 9 gray
          "#EF476F", // 10 pink/red
          "#06D6A0", // 11 mint
          "#26547C", // 12 navy
          "#FF9F1C"  // 13 orange
        ];
        return palette[c] || palette[0];
      }
      return "#A4CCCC";
    };

    return labels.map(label => ({
      id: label.id,
      name: label.name,
      color: mapWaColorToHex((label as any).color),
      count: countByLabel.get(String(label.id)) || 0
    }));
  } catch (error) {
    logger.warn(`[GetDeviceLabelsService] Erro ao buscar labels: ${error}`);
    return [];
  }
};

export default GetDeviceLabelsService;
