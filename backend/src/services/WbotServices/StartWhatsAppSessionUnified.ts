import { initWASocket } from "../../libs/wbot";
import { WhatsAppFactory } from "../../libs/whatsapp";
import Whatsapp from "../../models/Whatsapp";
import { wbotMessageListener } from "./wbotMessageListener";
import { getIO } from "../../libs/socket";
import wbotMonitor from "./wbotMonitor";
import logger from "../../utils/logger";
import * as Sentry from "@sentry/node";

/**
 * Inicia sessão WhatsApp usando adapters (Baileys ou Official API)
 * Versão unificada que detecta automaticamente o tipo de canal
 */
export const StartWhatsAppSessionUnified = async (
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> => {
  const channelType = whatsapp.channelType || "baileys";
  
  logger.info(`[StartSession] Iniciando ${channelType} para whatsappId=${whatsapp.id}`);

  await whatsapp.update({ status: "OPENING" });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company-${companyId}-whatsappSession`, {
      action: "update",
      session: whatsapp
    });

  try {
    if (channelType === "baileys") {
      // ===== BAILEYS (não oficial) =====
      logger.info(`[StartSession] Usando Baileys para whatsappId=${whatsapp.id}`);
      
      const wbot = await initWASocket(whatsapp);
      
      if (wbot.id) {
        // Configurar listeners Baileys (código existente)
        wbotMessageListener(wbot, companyId);
        wbotMonitor(wbot, whatsapp, companyId);
        
        logger.info(`[StartSession] Baileys iniciado com sucesso: ${wbot.user?.id}`);
      }
      
    } else if (channelType === "official") {
      // ===== WHATSAPP BUSINESS API OFICIAL =====
      logger.info(`[StartSession] Usando Official API para whatsappId=${whatsapp.id}`);
      
      // Criar adapter da API oficial
      const adapter = await WhatsAppFactory.createAdapter(whatsapp);
      
      // Inicializar (verifica credenciais e conecta)
      await adapter.initialize();
      
      // Registrar callback de conexão
      adapter.onConnectionUpdate((status) => {
        logger.info(`[StartSession] Official API status changed: ${status}`);
        
        // Atualizar status no banco
        if (status === "connected") {
          whatsapp.update({ status: "CONNECTED" });
        } else if (status === "disconnected") {
          whatsapp.update({ status: "DISCONNECTED" });
        }
        
        // Emitir evento via Socket.IO
        io.of(`/workspace-${companyId}`)
          .emit(`company-${companyId}-whatsappSession`, {
            action: "update",
            session: whatsapp
          });
      });
      
      // Registrar callback de mensagens recebidas
      // Nota: Mensagens da Official API vêm via webhooks, não polling
      // Este callback é chamado pelo webhook handler
      adapter.onMessage((message) => {
        logger.debug(`[StartSession] Mensagem recebida via Official API: ${message.id}`);
        // O processamento da mensagem será feito pelo webhook handler
      });
      
      // Atualizar status
      await whatsapp.update({ 
        status: "CONNECTED",
        number: adapter.getPhoneNumber()
      });
      
      logger.info(`[StartSession] Official API conectada: ${adapter.getPhoneNumber()}`);
      
      // Emitir evento de conexão
      io.of(`/workspace-${companyId}`)
        .emit(`company-${companyId}-whatsappSession`, {
          action: "update",
          session: whatsapp
        });
      
    } else {
      throw new Error(`Tipo de canal não suportado: ${channelType}`);
    }
    
  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(`[StartSession] Erro ao iniciar sessão: ${err.message}`);
    
    // Atualizar status de erro
    await whatsapp.update({ status: "DISCONNECTED" });
    
    // Emitir evento de erro
    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-whatsappSession`, {
        action: "update",
        session: whatsapp
      });
    
    throw err;
  }
};

/**
 * Para manter compatibilidade, exportar também a versão original
 * Apenas delega para a versão unificada
 */
export const StartWhatsAppSession = StartWhatsAppSessionUnified;

export default StartWhatsAppSession;
