import { Op } from "sequelize";
import Whatsapp from "../models/Whatsapp";
import logger from "../utils/logger";
import { StartWhatsAppSessionUnified } from "../services/WbotServices/StartWhatsAppSessionUnified";
import { getWbotIsReconnecting, getWbotSessionIds } from "../libs/wbot";

/**
 * checkOrphanedSessionsCron - VERSÃO SIMPLIFICADA PARA AMBIENTE SINGLE-INSTANCE
 * 
 * Verifica se sessões marcadas como CONNECTED no banco estão realmente ativas.
 * Em ambiente single-instance, não precisamos de Redis lock - basta verificar
 * se a sessão existe no array `sessions` em memória.
 */
export const checkOrphanedSessionsCron = () => {
    // Intervalo de verificação: 30 segundos (aumentado para evitar conflitos)
    setInterval(async () => {
        try {
            const whatsapps = await Whatsapp.findAll({
                where: {
                    status: { [Op.or]: ["CONNECTED", "OPENING"] },
                    channel: "whatsapp"
                }
            });

            if (whatsapps.length === 0) return;

            // Obter IDs das sessões ativas em memória
            const activeSessionIds = getWbotSessionIds();

            for (const whatsapp of whatsapps) {
                // Verificar se sessão já está em processo de reconexão
                if (getWbotIsReconnecting(whatsapp.id)) {
                    logger.debug(`[OrphanedCron] Sessão ${whatsapp.name} (#${whatsapp.id}) já está reconectando. Pulando.`);
                    continue;
                }

                // Verificar se a sessão está ativa em memória
                const isActive = activeSessionIds.includes(whatsapp.id);

                // Se NÃO está ativa em memória, mas o status é CONNECTED no banco,
                // significa que a sessão foi perdida. Tenta reconectar.
                if (!isActive) {
                    logger.info(`[OrphanedCron] Sessão ${whatsapp.name} (#${whatsapp.id}) parece órfã (não está em memória). Tentando reconectar...`);
                    StartWhatsAppSessionUnified(whatsapp, whatsapp.companyId);
                }
            }
        } catch (err) {
            logger.error(`[OrphanedCron] Erro: ${err}`);
        }
    }, 30000); // 30s (aumentado de 10s para evitar conflitos)
};
