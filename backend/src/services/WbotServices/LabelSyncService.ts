import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import GetWhatsappWbot from "../../helpers/GetWhatsappWbot";
import logger from "../../utils/logger";
import { addChatLabelAssociation, clearCache, upsertLabel } from "../../libs/labelCache";
import createOrUpdateBaileysService from "../BaileysServices/CreateOrUpdateBaileysService";
import ShowBaileysService from "../BaileysServices/ShowBaileysService";
import GetDeviceLabelsService from "./GetDeviceLabelsService";

interface SyncOptions {
  companyId: number;
  whatsappId?: number;
  force?: boolean;
  useWebClient?: boolean;
}

interface LabelStoreItem {
  id?: string;
  name?: string;
  hexColor?: string;
  color?: string;
  predefinedId?: string;
  deleted?: boolean;
}

interface LabelRelationItem {
  id?: string;
  jid?: string;
  labelId?: string;
  chatId?: string;
  lid?: string;
  type?: string;
}

const LABEL_RECHECK_TTL = 3 * 60 * 1000;
const lastSync = new Map<number, number>();

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function readLabelStore(client: any) {
  try {
    const stores = await client.pupPage?.evaluate(() => {
      // @ts-ignore
      const labelStore = window?.Store?.Label;
      // @ts-ignore
      const labelAssocStore = window?.Store?.LabelChat;
      if (!labelStore || !labelAssocStore) {
        return null;
      }
      return {
        labels: labelStore.getModelsArray()?.map((l: any) => ({
          id: l?.id?._serialized || l?.id,
          name: l?.name,
          hexColor: l?.hexColor,
          color: l?.color,
          predefinedId: l?.predefinedId,
          deleted: l?.isDeleted || l?.deleted
        })) || [],
        relations: labelAssocStore.getModelsArray()?.map((assoc: any) => ({
          id: assoc?.id?._serialized || assoc?.id,
          jid: assoc?.id?._serialized || assoc?.id,
          labelId: assoc?.labelId,
          chatId: assoc?.chatId,
          lid: assoc?.labelId
        })) || []
      };
    });
    if (!stores) return null;
    return {
      labels: (stores.labels || []).filter((l: any) => !!l?.id),
      relations: (stores.relations || []).filter((r: any) => !!(r?.jid || r?.chatId) && !!(r?.labelId || r?.lid))
    };
  } catch (err: any) {
    logger.warn(`[LabelSyncService] Falha ao ler LabelStore via puppeteer: ${err?.message}`);
    return null;
  }
}

async function persistRelations(whatsappId: number, relations: LabelRelationItem[]) {
  if (!Array.isArray(relations) || relations.length === 0) return 0;
  let persisted = 0;
  const batch: any[] = [];
  const seen = new Map<string, Set<string>>();
  for (const relation of relations) {
    const chatId = String(relation?.chatId || relation?.jid || "");
    const labelId = String(relation?.labelId || relation?.lid || "");
    if (!chatId || !labelId) continue;
    addChatLabelAssociation(whatsappId, chatId, labelId, true);
    let set = seen.get(chatId);
    if (!set) {
      set = new Set();
      seen.set(chatId, set);
    }
    set.add(labelId);
    persisted++;
  }
  for (const [chatId, labels] of seen.entries()) {
    batch.push({ id: chatId, labels: Array.from(labels), labelsAbsolute: true });
  }
  if (batch.length) {
    await createOrUpdateBaileysService({ whatsappId, chats: batch as any });
  }
  return persisted;
}

async function persistLabels(whatsappId: number, labels: LabelStoreItem[]) {
  if (!Array.isArray(labels) || labels.length === 0) return 0;
  let persisted = 0;
  for (const label of labels) {
    const id = String(label?.id || "");
    if (!id) continue;
    const name = String(label?.name || id);
    const color = label?.hexColor || label?.color;
    upsertLabel(whatsappId, { id, name, color, predefinedId: label?.predefinedId, deleted: label?.deleted });
    persisted++;
  }
  return persisted;
}

async function syncViaBaileys(whatsappId: number) {
  const baileysData = await ShowBaileysService(whatsappId);
  const parseMaybeJSON = (val: any) => {
    try {
      if (!val) return null;
      if (typeof val === "string") return JSON.parse(val);
      return val;
    } catch {
      return null;
    }
  };
  const chats = parseMaybeJSON((baileysData as any).chats);
  if (!Array.isArray(chats)) return 0;

  let associations = 0;
  for (const chat of chats) {
    const chatId = String(chat?.id || "");
    if (!chatId) continue;
    const rawLabels = Array.isArray(chat?.labels) ? chat.labels : (Array.isArray(chat?.labelIds) ? chat.labelIds : []);
    const ids = Array.from(new Set((rawLabels || []).map((item: any) => String(typeof item === "object" ? item?.id || item?.value || item : item))));
    if (!ids.length) continue;
    for (const labelId of ids) {
      const sid = String(labelId);
      upsertLabel(whatsappId, { id: sid, name: sid });
      addChatLabelAssociation(whatsappId, chatId, sid, true);
      associations++;
    }
  }
  return associations;
}

async function syncViaWebClient(whatsappId: number, client: any) {
  const store = await readLabelStore(client);
  if (!store) return { labels: 0, relations: 0 };
  const labelsPersisted = await persistLabels(whatsappId, store.labels as LabelStoreItem[]);
  const relationsPersisted = await persistRelations(whatsappId, store.relations as LabelRelationItem[]);
  return { labels: labelsPersisted, relations: relationsPersisted };
}

async function ensureResyncFromBaileys(whatsappId: number) {
  try {
    const wbot = await getWbotSafe(whatsappId);
    if (!wbot) return;
    const resyncable = typeof (wbot as any)?.resyncAppState === "function";
    if (!resyncable) return;
    const { ALL_WA_PATCH_NAMES } = require("@whiskeysockets/baileys");
    const labelPatches = (ALL_WA_PATCH_NAMES || []).filter((n: string) => /label/i.test(n));
    if (Array.isArray(labelPatches) && labelPatches.length > 0) {
      try {
        await (wbot as any).resyncAppState(labelPatches, true);
      } catch (err: any) {
        logger.warn(`[LabelSyncService] resyncAppState parcial falhou: ${err?.message}`);
      }
    }
    try {
      await (wbot as any).resyncAppState(ALL_WA_PATCH_NAMES, true);
    } catch (err: any) {
      logger.warn(`[LabelSyncService] resyncAppState completo falhou: ${err?.message}`);
    }
  } catch (err: any) {
    logger.warn(`[LabelSyncService] Não foi possível solicitar resyncAppState: ${err?.message}`);
  }
}

function getElapsed(whatsappId: number) {
  const ts = lastSync.get(whatsappId) || 0;
  return Date.now() - ts;
}

function markSync(whatsappId: number) {
  lastSync.set(whatsappId, Date.now());
}

function clearSyncMark(whatsappId: number) {
  lastSync.delete(whatsappId);
}

async function getWbotSafe(whatsappId: number) {
  try {
    const whatsapp = await GetDefaultWhatsApp(whatsappId, undefined);
    return await GetWhatsappWbot(whatsapp);
  } catch (err: any) {
    logger.warn(`[LabelSyncService] getWbotSafe falhou: ${err?.message}`);
    return null;
  }
}

const LabelSyncService = {
  async sync(options: SyncOptions) {
    const { companyId, whatsappId, force, useWebClient } = options;
    const whatsapp = await GetDefaultWhatsApp(whatsappId, companyId);
    const targetId = whatsapp.id;

    if (!force && getElapsed(targetId) < LABEL_RECHECK_TTL) {
      logger.info(`[LabelSyncService] Ignorando sync (TTL ativo) para whatsappId=${targetId}`);
      return { source: "ttl_skip" };
    }

    try {
      logger.info(`[LabelSyncService] Iniciando sync para whatsappId=${targetId}`);
      markSync(targetId);

      clearCache(targetId);

      await ensureResyncFromBaileys(targetId);
      await delay(2000);

      let associations = await syncViaBaileys(targetId);
      let labelsFromWeb = 0;
      let relationsFromWeb = 0;

      if (associations === 0 || force || useWebClient) {
        let client = null;
        try {
          const WhatsAppWebLabelsService = require("./WhatsAppWebLabelsService").default;
          client = await WhatsAppWebLabelsService.getOrCreateClient(targetId);
        } catch (err: any) {
          logger.warn(`[LabelSyncService] Falha ao obter cliente web: ${err?.message}`);
        }
        if (client) {
          const res = await syncViaWebClient(targetId, client);
          labelsFromWeb = res.labels;
          relationsFromWeb = res.relations;
        }
      }

      const totalLabels = (await GetDeviceLabelsService(companyId, targetId)).length;
      const source = relationsFromWeb > 0 ? "web" : (associations > 0 ? "baileys" : "empty");
      return { source, labelsFromWeb, relationsFromWeb, associations, totalLabels };
    } catch (err: any) {
      clearSyncMark(targetId);
      logger.error(`[LabelSyncService] Erro durante sync: ${err?.message}`);
      throw err;
    }
  }
};

export default LabelSyncService;
