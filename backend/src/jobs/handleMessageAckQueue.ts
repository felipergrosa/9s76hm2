import { handleMsgAck } from "../services/WbotServices/wbotMessageListener";
import logger from "../utils/logger";

export default {
  key: `${process.env.DB_NAME}-handleMessageAck`,
  options: {
    priority: 1
  },
  async handle({ data }) {
    const { msg, chat, companyId } = data || {};
    const wid = msg?.key?.id;

    try {
      if (!Number.isSafeInteger(Number(companyId)) || Number(companyId) <= 0) {
        throw new Error("ACK job sem companyId válido");
      }
      await handleMsgAck(msg, chat, Number(companyId));
    } catch (error: any) {
      logger.error(
        {
          error: error?.message || error,
          stack: error?.stack,
          wid,
          chat,
          companyId
        },
        "[handleMessageAckQueue] Falha ao processar ACK"
      );

      // CRITICO: relançar para Bull aplicar retry/backoff e não perder ACK.
      throw error;
    }
  },
};
