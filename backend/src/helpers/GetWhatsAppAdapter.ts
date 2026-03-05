import { WhatsAppFactory, IWhatsAppAdapter } from "../libs/whatsapp";
import Whatsapp from "../models/Whatsapp";
import Ticket from "../models/Ticket";
import AppError from "../errors/AppError";
import logger from "../utils/logger";

/**
 * Obtém o adapter apropriado para o WhatsApp (Baileys ou Official API)
 * Similar ao GetTicketWbot, mas retorna IWhatsAppAdapter unificado
 * Agora com retry automático e reinicialização inteligente
 */
const GetWhatsAppAdapter = async (
  whatsapp: Whatsapp,
  retryCount: number = 0
): Promise<IWhatsAppAdapter> => {
  const MAX_RETRIES = 2;
  
  try {
    logger.debug(`[GetWhatsAppAdapter] Obtendo adapter para whatsappId=${whatsapp.id}, retry=${retryCount}`);
    
    // Criar ou retornar adapter do cache
    const adapter = await WhatsAppFactory.createAdapter(whatsapp);
    
    // Verificar status
    let status = adapter.getConnectionStatus();
    logger.debug(`[GetWhatsAppAdapter] Status atual: ${status}`);
    
    // Se não conectado, tentar reinicializar
    if (status !== "connected") {
      logger.warn(`[GetWhatsAppAdapter] Status ${status}, tentando reinicializar...`);
      
      try {
        await adapter.initialize();
        status = adapter.getConnectionStatus();
        logger.info(`[GetWhatsAppAdapter] Reinicializado com sucesso, novo status: ${status}`);
      } catch (initError: any) {
        logger.error(`[GetWhatsAppAdapter] Falha ao reinicializar: ${initError.message}`);
        
        // Se falhou e ainda temos retries, tentar novamente
        if (retryCount < MAX_RETRIES) {
          logger.info(`[GetWhatsAppAdapter] Tentando novamente em 2s... (${retryCount + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Limpar adapter do cache para forçar recriação
          WhatsAppFactory.removeAdapter(whatsapp.id);
          
          return GetWhatsAppAdapter(whatsapp, retryCount + 1);
        }
      }
    }
    
    // Verificar status final
    if (status !== "connected") {
      throw new AppError(
        `WhatsApp não está conectado. Status: ${status}`,
        404
      );
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
