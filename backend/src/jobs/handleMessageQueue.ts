import { getWbot } from "../libs/wbot";
import { handleMessage } from "../services/WbotServices/wbotMessageListener";
import logger from "../utils/logger";

export default {
  key: `${process.env.DB_NAME}-handleMessage`,

  async handle({ data }) {
    const { message, wbot, companyId } = data || {};

    if (!message || wbot === undefined || companyId === undefined) {
      const error = new Error("[handleMessageQueue] Payload inválido");
      logger.error(
        {
          messageExists: Boolean(message),
          wbot,
          companyId
        },
        error.message
      );
      throw error;
    }

    const wid = message?.key?.id;
    const remoteJid = message?.key?.remoteJid;
    const fromMe = Boolean(message?.key?.fromMe);

    try {
      const w = getWbot(wbot);
      await handleMessage(message, w, companyId);
    } catch (error: any) {
      logger.error(
        {
          error: error?.message || error,
          stack: error?.stack,
          wid,
          remoteJid,
          fromMe,
          wbot,
          companyId
        },
        "[handleMessageQueue] Falha ao processar mensagem"
      );

      // CRITICO: relançar para Bull aplicar retry/backoff e não perder mensagem.
      throw error;
    }
  }
};
