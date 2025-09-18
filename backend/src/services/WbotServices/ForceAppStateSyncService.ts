import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import logger from "../../utils/logger";
import { ALL_WA_PATCH_NAMES } from "@whiskeysockets/baileys";
import { getLabels } from "../../libs/labelCache";

const ForceAppStateSyncService = async (companyId: number, whatsappId?: number) => {
  const defaultWhatsapp = await GetDefaultWhatsApp(whatsappId, companyId);
  logger.info(`[ForceAppStateSyncService] Forçando resync de App State para whatsappId=${defaultWhatsapp.id}`);

  const wbot = getWbot(defaultWhatsapp.id) as any;

  if (!wbot || typeof wbot.resyncAppState !== 'function') {
    throw new Error("Função resyncAppState não disponível no socket atual");
  }

  await wbot.resyncAppState(ALL_WA_PATCH_NAMES as any, true);
  logger.info(`[ForceAppStateSyncService] Resync solicitado com sucesso`);

  // Aguardar labels caírem no cache por até ~8s (polling a cada 400ms)
  const start = Date.now();
  let labelsCount = 0;
  const timeoutMs = 8000;
  const step = 400;
  while (Date.now() - start < timeoutMs) {
    const arr = getLabels(defaultWhatsapp.id);
    labelsCount = Array.isArray(arr) ? arr.length : 0;
    if (labelsCount > 0) break;
    await new Promise(r => setTimeout(r, step));
  }

  logger.info(`[ForceAppStateSyncService] Labels no cache após resync: ${labelsCount}`);
  return { ok: true, labelsCount, waitedMs: Date.now() - start };
};

export default ForceAppStateSyncService;
