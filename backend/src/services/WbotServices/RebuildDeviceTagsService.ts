import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import ShowBaileysService from "../BaileysServices/ShowBaileysService";
import logger from "../../utils/logger";
import { upsertLabel, addChatLabelAssociation, getLabelMap } from "../../libs/labelCache";
import createOrUpdateBaileysService from "../BaileysServices/CreateOrUpdateBaileysService";

interface Result {
  whatsappId: number;
  labelsUpserted: number;
  chatsWithLabels: number;
  associations: number;
}

const RebuildDeviceTagsService = async (companyId: number, whatsappId?: number): Promise<Result> => {
  const whatsapp = await GetDefaultWhatsApp(whatsappId, companyId);

  const baileysData = await ShowBaileysService(whatsapp.id);

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
  if (!Array.isArray(chats) || chats.length === 0) {
    logger.info(`[RebuildDeviceTagsService] Baileys.chats vazio para whatsappId=${whatsapp.id}`);
    return { whatsappId: whatsapp.id, labelsUpserted: 0, chatsWithLabels: 0, associations: 0 };
  }

  let labelsUpserted = 0;
  let chatsWithLabels = 0;
  let associations = 0;

  const labelMap = getLabelMap(whatsapp.id);

  for (const chat of chats) {
    const raw = Array.isArray(chat?.labels) ? chat.labels : (Array.isArray(chat?.labelIds) ? chat.labelIds : []);
    const rawIds: string[] = (raw || []).map((x: any) => String(typeof x === 'object' ? (x.id ?? x.value ?? x) : x));
    const ids: string[] = Array.from(new Set<string>(rawIds));
    if (ids.length === 0) continue;

    chatsWithLabels++;

    for (const id of ids) {
      const sid = String(id);
      const cached = labelMap.get(sid);
      const name: string = (cached?.name as string) || sid;
      const color = cached?.color as any;
      upsertLabel(whatsapp.id, { id: sid, name, color });
      labelsUpserted++;
      addChatLabelAssociation(whatsapp.id, String(chat.id), sid, true);
      associations++;
    }

    // Persistir também em Baileys.chats (garante fallback futuro)
    try {
      await createOrUpdateBaileysService({
        whatsappId: whatsapp.id,
        chats: [{ id: chat.id, labels: ids, labelsAbsolute: true }] as any
      });
    } catch (e: any) {
      logger.warn(`[RebuildDeviceTagsService] Falha ao persistir labels para chat=${chat.id}: ${e?.message}`);
    }
  }

  logger.info(`[RebuildDeviceTagsService] labelsUpserted=${labelsUpserted} chatsWithLabels=${chatsWithLabels} associations=${associations}`);
  return { whatsappId: whatsapp.id, labelsUpserted, chatsWithLabels, associations };
};

export default RebuildDeviceTagsService;
