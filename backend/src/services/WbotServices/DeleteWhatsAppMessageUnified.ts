import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import { GetTicketAdapter } from "../../helpers/GetWhatsAppAdapter";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import logger from "../../utils/logger";

interface Request {
  messageId: string | number;
  ticket: Ticket;
}

/**
 * Serviço unificado de exclusão de mensagem WhatsApp
 * Suporta Baileys e Official API
 * 
 * IMPORTANTE:
 * - Baileys: Pode deletar mensagens antigas
 * - Official API: Só pode deletar até 24h após envio
 */
const DeleteWhatsAppMessageUnified = async ({
  messageId,
  ticket
}: Request): Promise<void> => {
  
  try {
    logger.info(`[DeleteMessageUnified] Deletando mensagem ${messageId} do ticket ${ticket.id}`);
    
    // Buscar mensagem no banco
    const message = await Message.findByPk(messageId);
    
    if (!message) {
      throw new AppError("ERR_MESSAGE_NOT_FOUND", 404);
    }

    // Verificar se é mensagem própria (fromMe)
    if (!message.fromMe) {
      throw new AppError("ERR_CANNOT_DELETE_RECEIVED_MESSAGE", 403);
    }

    // Obter adapter apropriado
    const adapter = await GetTicketAdapter(ticket);
    const channelType = adapter.channelType;
    
    logger.debug(`[DeleteMessageUnified] Canal: ${channelType}, WID: ${message.wid}`);

    // ===== VERIFICAR RESTRIÇÕES API OFICIAL =====
    if (channelType === "official") {
      // WhatsApp Business API só permite deletar mensagens até 24h
      const messageAge = Date.now() - new Date(message.createdAt).getTime();
      const hoursAge = messageAge / (1000 * 60 * 60);
      
      if (hoursAge > 24) {
        throw new AppError(
          "Não é possível deletar mensagens com mais de 24 horas pela API Oficial",
          400
        );
      }
    }

    // ===== DELETAR VIA ADAPTER =====
    if (message.wid) {
      try {
        await adapter.deleteMessage(message.wid);
        logger.info(`[DeleteMessageUnified] Mensagem deletada no WhatsApp: ${message.wid}`);
      } catch (deleteError: any) {
        logger.warn(`[DeleteMessageUnified] Erro ao deletar no WhatsApp: ${deleteError.message}`);
        // Continua para deletar do banco mesmo se falhar no WhatsApp
      }
    }

    // ===== DELETAR DO BANCO =====
    await message.destroy();
    logger.info(`[DeleteMessageUnified] Mensagem removida do banco: ${messageId}`);

  } catch (error: any) {
    Sentry.captureException(error);
    logger.error(`[DeleteMessageUnified] Erro ao deletar mensagem: ${error.message}`);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      error.message || "ERR_DELETING_WAPP_MSG",
      error.statusCode || 500
    );
  }
};

export default DeleteWhatsAppMessageUnified;
