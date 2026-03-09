import Whatsapp from "../models/Whatsapp";
import { getWbot, removeWbot, getWbotIsReconnecting } from "../libs/wbot";
import { StartWhatsAppSessionUnified as StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSessionUnified";
import { getIO } from "../libs/socket";
import logger from "../utils/logger";

/**
 * Job Bull Queue: WhatsAppHealthCheck
 * 
 * Verifica saúde de UMA conexão WhatsApp específica.
 * 
 * Trigger:
 * - Recorrente via BullScheduler.scheduleRecurring() a cada 5 min
 * - Ou event-driven quando desconexão detectada
 * 
 * Substitui: WhatsAppHealthCheckJob (polling setInterval)
 */

// Tempo mínimo entre reconexões da mesma sessão (10 minutos)
const MIN_RECONNECT_INTERVAL_MS = 10 * 60 * 1000;

// Mapa para controlar última tentativa de reconexão por whatsappId
const lastReconnectAttempt = new Map<number, number>();

export default {
  key: `${process.env.DB_NAME}-WhatsAppHealthCheck`,

  async handle({ data }: { data: any }) {
    const { whatsappId, companyId } = data || {};

    if (!whatsappId) {
      throw new Error("[WhatsAppHealthCheckJob] whatsappId é obrigatório");
    }

    logger.debug(`[WhatsAppHealthCheckJob] Verificando conexão ${whatsappId}`);

    try {
      // Buscar WhatsApp no banco
      const whatsapp = await Whatsapp.findByPk(whatsappId, {
        attributes: ["id", "name", "status", "channelType", "companyId", "channel"]
      });

      if (!whatsapp) {
        logger.warn(`[WhatsAppHealthCheckJob] WhatsApp ${whatsappId} não encontrado`);
        return { success: false, reason: "Not found" };
      }

      // Ignorar se não for canal whatsapp
      if (whatsapp.channel !== "whatsapp") {
        return { success: true, skipped: true, reason: "Not WhatsApp channel" };
      }

      // Ignorar API Oficial (stateless, não precisa health check)
      if (whatsapp.channelType === "official") {
        return { success: true, skipped: true, reason: "Official API" };
      }

      // Verificar se já está em processo de reconexão
      if (getWbotIsReconnecting(whatsapp.id)) {
        logger.debug(`[WhatsAppHealthCheckJob] Conexão ${whatsapp.name} já está reconectando`);
        return { success: true, skipped: true, reason: "Already reconnecting" };
      }

      // Verificar saúde do socket
      const health = isSocketHealthy(whatsapp.id);

      if (health.healthy) {
        logger.debug(`[WhatsAppHealthCheckJob] Conexão ${whatsapp.name} está saudável`);
        return { success: true, healthy: true };
      }

      // Socket não está saudável
      logger.warn(
        `[WhatsAppHealthCheckJob] ⚠️ Conexão ${whatsapp.name} não está saudável: ${health.reason}`
      );

      // Se sessão está missing completamente, tentar reconectar
      if (health.missing && whatsapp.status === "CONNECTED") {
        // Verificar intervalo mínimo entre reconexões
        const lastAttempt = lastReconnectAttempt.get(whatsapp.id) || 0;
        const timeSinceLastAttempt = Date.now() - lastAttempt;

        if (timeSinceLastAttempt < MIN_RECONNECT_INTERVAL_MS) {
          const waitMinutes = Math.ceil((MIN_RECONNECT_INTERVAL_MS - timeSinceLastAttempt) / 60000);
          logger.info(
            `[WhatsAppHealthCheckJob] Aguardando ${waitMinutes}min antes de reconectar ${whatsapp.name}`
          );
          return { success: true, skipped: true, reason: "Cooldown period" };
        }

        // Tentar reconectar
        logger.info(`[WhatsAppHealthCheckJob] 🔄 Iniciando reconexão de ${whatsapp.name}`);
        
        lastReconnectAttempt.set(whatsapp.id, Date.now());

        try {
          // Limpar sessão antiga se existir
          if (!health.missing) {
            removeWbot(whatsapp.id);
          }

          // Iniciar nova sessão
          await StartWhatsAppSession(whatsapp, whatsapp.companyId);

          logger.info(`[WhatsAppHealthCheckJob] ✅ Reconexão iniciada: ${whatsapp.name}`);

          return {
            success: true,
            reconnected: true,
            whatsappId: whatsapp.id,
            name: whatsapp.name
          };

        } catch (reconnectError: any) {
          logger.error(
            `[WhatsAppHealthCheckJob] ❌ Erro ao reconectar ${whatsapp.name}: ${reconnectError.message}`
          );
          return {
            success: false,
            error: reconnectError.message,
            whatsappId: whatsapp.id
          };
        }
      }

      return {
        success: true,
        unhealthy: true,
        reason: health.reason,
        whatsappId: whatsapp.id
      };

    } catch (error: any) {
      logger.error(
        `[WhatsAppHealthCheckJob] ❌ Erro ao verificar conexão ${whatsappId}: ${error.message}`,
        { stack: error.stack }
      );
      throw error;
    }
  }
};

/**
 * Verifica se o WebSocket de uma sessão está realmente conectado
 */
function isSocketHealthy(whatsappId: number): { healthy: boolean; reason: string; missing: boolean } {
  try {
    const session = getWbot(whatsappId);

    if (!session) {
      return { healthy: false, reason: "Session not found in memory", missing: true };
    }

    // Verificar socket (compatível com Baileys v6/v7)
    const socket = (session as any).sock || (session as any).ws || session;

    if (!socket) {
      return { healthy: false, reason: "Socket not found", missing: false };
    }

    // Verificar readyState do WebSocket
    const readyState = socket.readyState || (socket as any).state?.connection;

    // readyState: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
    if (readyState === 1 || readyState === "open") {
      return { healthy: true, reason: "Socket open", missing: false };
    }

    return {
      healthy: false,
      reason: `Socket state: ${readyState}`,
      missing: false
    };

  } catch (error: any) {
    return {
      healthy: false,
      reason: `Error checking socket: ${error.message}`,
      missing: true
    };
  }
}
