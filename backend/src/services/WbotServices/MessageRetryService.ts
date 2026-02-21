import logger from "../../utils/logger";
import { proto } from "@whiskeysockets/baileys";

interface PendingMessage {
  id: string;
  message: proto.IWebMessageInfo;
  whatsappId: number;
  companyId: number;
  attempts: number;
  lastAttempt: number;
  error: string;
}

class MessageRetryService {
  private static pendingMessages = new Map<string, PendingMessage>();
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly RETRY_DELAY = 60000; // 1 minuto
  private static readonly CLEANUP_INTERVAL = 300000; // 5 minutos
  private static readonly MAX_AGE = 1800000; // 30 minutos

  /**
   * Adiciona mensagem para retry após recuperação de sessão
   */
  static addPendingMessage(
    message: proto.IWebMessageInfo,
    whatsappId: number,
    companyId: number,
    error: string
  ): void {
    const messageId = message.key?.id;
    const remoteJid = message.key?.remoteJid;
    
    if (!messageId || !remoteJid) {
      logger.warn("[MessageRetry] Mensagem sem ID ou remoteJid válido, ignorando");
      return;
    }

    const pendingId = `${whatsappId}-${messageId}-${remoteJid}`;
    
    const existing = this.pendingMessages.get(pendingId);
    if (existing) {
      existing.attempts++;
      existing.lastAttempt = Date.now();
      existing.error = error;
      
      if (existing.attempts >= this.MAX_ATTEMPTS) {
        logger.warn({
          pendingId,
          attempts: existing.attempts,
          whatsappId,
          messageId,
          remoteJid
        }, "[MessageRetry] Limite de tentativas atingido, removendo da fila");
        this.pendingMessages.delete(pendingId);
        return;
      }
    } else {
      const pendingMessage: PendingMessage = {
        id: pendingId,
        message,
        whatsappId,
        companyId,
        attempts: 1,
        lastAttempt: Date.now(),
        error
      };
      this.pendingMessages.set(pendingId, pendingMessage);
    }

    logger.info({
      pendingId,
      attempts: this.pendingMessages.get(pendingId)?.attempts,
      whatsappId,
      messageId,
      remoteJid,
      error
    }, "[MessageRetry] Mensagem adicionada para retry");
  }

  /**
   * Tenta reprocessar mensagens pendentes após recuperação de sessão
   */
  static async retryPendingMessages(whatsappId: number): Promise<void> {
    const pendingForWhatsapp = Array.from(this.pendingMessages.values())
      .filter(pending => pending.whatsappId === whatsappId);

    if (pendingForWhatsapp.length === 0) {
      return;
    }

    logger.info({
      whatsappId,
      pendingCount: pendingForWhatsapp.length
    }, "[MessageRetry] Iniciando retry de mensagens pendentes");

    for (const pending of pendingForWhatsapp) {
      try {
        // Importar dinamicamente para evitar dependência circular
        const { handleMessage } = await import("./wbotMessageListener");
        const { getWbot } = await import("../../libs/wbot");

        const wbot = getWbot(whatsappId);
        if (!wbot) {
          logger.warn({
            whatsappId,
            pendingId: pending.id
          }, "[MessageRetry] Wbot não encontrado para retry");
          continue;
        }

        await handleMessage(pending.message, wbot, pending.companyId);
        
        // Sucesso - remover da fila
        this.pendingMessages.delete(pending.id);
        
        logger.info({
          pendingId: pending.id,
          attempts: pending.attempts,
          whatsappId
        }, "[MessageRetry] Mensagem processada com sucesso no retry");

      } catch (error: any) {
        logger.warn({
          pendingId: pending.id,
          attempts: pending.attempts,
          whatsappId,
          error: error?.message || error
        }, "[MessageRetry] Falha no retry, mantendo na fila");

        // Atualizar tentativa
        pending.attempts++;
        pending.lastAttempt = Date.now();
        pending.error = error?.message || error;

        if (pending.attempts >= this.MAX_ATTEMPTS) {
          this.pendingMessages.delete(pending.id);
          logger.error({
            pendingId: pending.id,
            attempts: pending.attempts,
            whatsappId
          }, "[MessageRetry] Limite de tentativas atingido, removendo mensagem");
        }
      }

      // Delay entre retries para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Cleanup automático de mensagens antigas
   */
  static cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, pending] of this.pendingMessages.entries()) {
      const age = now - pending.lastAttempt;
      if (age > this.MAX_AGE) {
        this.pendingMessages.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info({
        cleanedCount,
        remaining: this.pendingMessages.size
      }, "[MessageRetry] Limpeza automática de mensagens antigas");
    }
  }

  /**
   * Obter estatísticas das mensagens pendentes
   */
  static getStats(): { 
    total: number; 
    byWhatsapp: Record<number, number>; 
    byError: Record<string, number> 
  } {
    const byWhatsapp: Record<number, number> = {};
    const byError: Record<string, number> = {};

    for (const pending of this.pendingMessages.values()) {
      byWhatsapp[pending.whatsappId] = (byWhatsapp[pending.whatsappId] || 0) + 1;
      byError[pending.error] = (byError[pending.error] || 0) + 1;
    }

    return {
      total: this.pendingMessages.size,
      byWhatsapp,
      byError
    };
  }
}

// Cleanup automático a cada 5 minutos
setInterval(() => {
  MessageRetryService.cleanup();
}, MessageRetryService["CLEANUP_INTERVAL"]);

export default MessageRetryService;
