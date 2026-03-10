import { getWbotOrRecover } from "../libs/wbot";
import { handleMessage } from "../services/WbotServices/wbotMessageListener";
import logger from "../utils/logger";
import pTimeout from "p-timeout";

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
    const isGroup = remoteJid?.endsWith("@g.us");

    try {
      // CORREÇÃO: Usar getWbotOrRecover para aguardar sessão durante reconexão
      // Isso evita ERR_WAPP_NOT_INITIALIZED quando sessão está em processo de reconexão
      const w = await getWbotOrRecover(wbot, 30000); // Aguarda até 30s

      if (!w) {
        logger.warn({ wbot }, "[handleMessageQueue] Sessão não recuperada após 30s - descartando mensagem");
        return; // Descartar mensagem - Bull não faz retry
      }

      // PROTEÇÃO CRÍTICA: Timeout de 45s para dar mais tempo para processamento
      // Aumentado de 25s para evitar falhas em mensagens complexas com mídia
      await pTimeout(handleMessage(message, w, companyId), 45000);
    } catch (error: any) {
      const isTimeout = error?.message?.includes('Timeout');
      
      logger.error(
        {
          error: error?.message || error,
          stack: error?.stack,
          wid,
          remoteJid,
          fromMe,
          isGroup,
          isTimeout,
          wbot,
          companyId
        },
        "[handleMessageQueue] Falha ao processar mensagem"
      );

      // TIMEOUT ou ERR_WAPP_NOT_INITIALIZED: NÃO fazer retry
      // Evita loop infinito de mensagens problemáticas crashando websocket
      if (isTimeout || error?.message?.includes('ERR_WAPP_NOT_INITIALIZED')) {
        logger.warn(
          { wid, remoteJid, isGroup, error: error?.message },
          "[handleMessageQueue] Mensagem descartada (timeout ou sessão morta) - não será reprocessada"
        );
        return; // Sucesso artificial - Bull não faz retry
      }

      // CRITICO: relançar para Bull aplicar retry/backoff e não perder mensagem.
      throw error;
    }
  }
};
