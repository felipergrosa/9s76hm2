import { handleMsgAck } from "../services/WbotServices/wbotMessageListener";
import logger from "../utils/logger";

export default {
  key: `${process.env.DB_NAME}-handleMessageAck`,
  options: {
    priority: 1
  },
  async handle({ data }) {
    const { msg, chat } = data || {};
    const wid = msg?.key?.id;

    try {
      await handleMsgAck(msg, chat);
    } catch (error: any) {
      logger.error(
        {
          error: error?.message || error,
          stack: error?.stack,
          wid,
          chat
        },
        "[handleMessageAckQueue] Falha ao processar ACK"
      );

      // CRITICO: relançar para Bull aplicar retry/backoff e não perder ACK.
      throw error;
    }
  },
};
