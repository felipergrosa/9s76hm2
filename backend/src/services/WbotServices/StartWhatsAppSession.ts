import { initWASocket } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import wbotMessageListener from "./wbotMessageListener";
import { getIO } from "../../libs/socket";
import wbotMonitor from "./wbotMonitor";
import logger from "../../utils/logger";
import * as Sentry from "@sentry/node";

export const StartWhatsAppSession = async (
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> => {
  await whatsapp.update({ status: "OPENING" });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company-${companyId}-whatsappSession`, {
      action: "update",
      session: whatsapp
    });

  try {
    const wbot = await initWASocket(whatsapp);

    if (wbot.id) {
      wbotMessageListener(wbot, companyId);
      wbotMonitor(wbot, whatsapp, companyId);

      // Reidratar cache de labels e associações do banco de dados
      // Isso permite que o Baileys tenha acesso às labels mesmo após restart
      setTimeout(async () => {
        try {
          const { loadLabelsFromDatabase, loadChatLabelsFromDatabase } = require("../../libs/labelCache");
          await loadLabelsFromDatabase(whatsapp.id);
          await loadChatLabelsFromDatabase(whatsapp.id);
        } catch (e: any) {
          logger.warn(`[StartWhatsAppSession] Falha ao reidratar cache de labels: ${e?.message}`);
        }
      }, 2000);
    }
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
  }
};
