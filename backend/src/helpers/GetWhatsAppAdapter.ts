import { WhatsAppFactory, IWhatsAppAdapter } from "../libs/whatsapp";
import Whatsapp from "../models/Whatsapp";
import Ticket from "../models/Ticket";
import AppError from "../errors/AppError";
import logger from "../utils/logger";

/**
 * Obtém o adapter apropriado para o WhatsApp (Baileys ou Official API)
 * Similar ao GetTicketWbot, mas retorna IWhatsAppAdapter unificado
 */
const GetWhatsAppAdapter = async (
  whatsapp: Whatsapp
): Promise<IWhatsAppAdapter> => {
  try {
    logger.debug(`[GetWhatsAppAdapter] Obtendo adapter para whatsappId=${whatsapp.id}, channelType=${whatsapp.channelType}`);
    
    // Criar ou retornar adapter do cache
    const adapter = await WhatsAppFactory.createAdapter(whatsapp);
    
    // Verificar se está conectado
    const status = adapter.getConnectionStatus();
    if (status !== "connected") {
      logger.warn(`[GetWhatsAppAdapter] Adapter não conectado: ${status}. Tentando inicializar...`);
      
      try {
        await adapter.initialize();
      } catch (initError: any) {
        logger.error(`[GetWhatsAppAdapter] Erro ao inicializar adapter: ${initError.message}`);
        throw new AppError(
          `WhatsApp não está conectado. Status: ${status}. Erro: ${initError.message}`,
          404
        );
      }
    }
    
    return adapter;
    
  } catch (error: any) {
    logger.error(`[GetWhatsAppAdapter] Erro ao obter adapter: ${error.message}`);
    throw new AppError(
      error.message || "Erro ao obter conexão WhatsApp",
      error.statusCode || 500
    );
  }
};

/**
 * Obtém o adapter a partir de um ticket
 * Wrapper conveniente para uso em services
 */
export const GetTicketAdapter = async (
  ticket: Ticket
): Promise<IWhatsAppAdapter> => {
  if (!ticket.whatsappId) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);

  if (!whatsapp) {
    throw new AppError("ERR_WAPP_NOT_FOUND", 404);
  }

  return GetWhatsAppAdapter(whatsapp);
};

export default GetWhatsAppAdapter;
