import Whatsapp from "../models/Whatsapp";
import { getWbotSessionIds, getWbotIsReconnecting } from "../libs/wbot";
import { WhatsAppFactory } from "../libs/whatsapp";
import { StartWhatsAppSessionUnified } from "../services/WbotServices/StartWhatsAppSessionUnified";
import logger from "../utils/logger";

/**
 * Job: OrphanedSessionCheck - Verifica e recupera sessões WhatsApp órfãs
 * 
 * Responsabilidades:
 * - Verificar se sessões marcadas como CONNECTED realmente estão ativas
 * - Detectar desconexões não detectadas
 * - Iniciar recuperação automática
 * 
 * Trigger:
 * - Evento: Session disconnected detectado
 * - Timing: Imediato (sem delay)
 * 
 * NOTA: Este job substitui o checkOrphanedSessionsCron (30s polling)
 * Versão event-driven: só executa quando há suspeita de desconexão
 */
export default {
  key: `${process.env.DB_NAME}-OrphanedSessionCheck`,

  async handle({ data }: { data: any }) {
    const { whatsappId, reason } = data || {};

    if (!whatsappId) {
      throw new Error("[OrphanedSessionCheck] whatsappId é obrigatório");
    }

    logger.info(`[OrphanedSessionCheck] Verificando sessão ${whatsappId}`, { reason });

    try {
      // Buscar WhatsApp no banco
      const whatsapp = await Whatsapp.findByPk(whatsappId, {
        attributes: ["id", "name", "status", "channelType", "companyId"]
      });

      if (!whatsapp) {
        logger.warn(`[OrphanedSessionCheck] WhatsApp ${whatsappId} não encontrado`);
        return { success: false, error: "Not found" };
      }

      // IGNORAR API Oficial - não tem sessão persistente
      if (whatsapp.channelType === "official") {
        logger.debug(`[OrphanedSessionCheck] Pulando API Oficial: ${whatsapp.name}`);
        return { success: true, skipped: true, reason: "Official API" };
      }

      // Verificar se está marcado como conectado
      if (whatsapp.status !== "CONNECTED" && whatsapp.status !== "OPENING") {
        logger.info(
          `[OrphanedSessionCheck] ${whatsapp.name} status=${whatsapp.status}. ` +
          `Não requer recuperação.`
        );
        return { success: true, skipped: true, reason: "Status not connected" };
      }

      // Verificar se sessão existe em memória
      const baileysSessionIds = getWbotSessionIds();
      const isActive = baileysSessionIds.includes(whatsapp.id);

      if (isActive) {
        logger.info(
          `[OrphanedSessionCheck] ${whatsapp.name} está ativa em memória. OK.`
        );
        return { success: true, skipped: true, reason: "Session active" };
      }

      // Verificar se já está em processo de reconexão (evita duplicatas)
      if (getWbotIsReconnecting(whatsapp.id)) {
        logger.info(
          `[OrphanedSessionCheck] ${whatsapp.name} já está em processo de reconexão. Pulando.`
        );
        return { success: true, skipped: true, reason: "Already reconnecting" };
      }

      // SESSÃO ÓRFÃ DETECTADA - Recuperar
      logger.warn(
        `[OrphanedSessionCheck] ⚠️ SESSÃO ÓRFÃ: ${whatsapp.name} (#${whatsapp.id}) ` +
        `status=${whatsapp.status} mas não está em memória. Iniciando recuperação...`
      );

      // Iniciar recuperação
      await StartWhatsAppSessionUnified(whatsapp, whatsapp.companyId);

      logger.info(
        `[OrphanedSessionCheck] ✅ Recuperação iniciada: ${whatsapp.name}`
      );

      return {
        success: true,
        recovered: true,
        whatsappId: whatsapp.id,
        name: whatsapp.name,
      };

    } catch (error: any) {
      logger.error(
        `[OrphanedSessionCheck] ❌ Erro ao verificar sessão ${whatsappId}`,
        { error: error.message, stack: error.stack }
      );
      throw error; // Bull faz retry
    }
  }
};
