import { Op } from "sequelize";
import Whatsapp from "../models/Whatsapp";
import logger from "../utils/logger";
import { StartWhatsAppSessionUnified } from "../services/WbotServices/StartWhatsAppSessionUnified";
import { getWbotIsReconnecting, getWbotSessionIds } from "../libs/wbot";
import { WhatsAppFactory } from "../libs/whatsapp";

/**
 * checkOrphanedSessionsCron - VERSÃO CORRIGIDA
 * 
 * Verifica se sessões marcadas como CONNECTED no banco estão realmente ativas.
 * Agora inclui tanto Baileys quanto API Oficial na verificação.
 */
export const checkOrphanedSessionsCron = () => {
    // Intervalo de verificação: 30 segundos
    setInterval(async () => {
        try {
            const whatsapps = await Whatsapp.findAll({
                where: {
                    status: { [Op.or]: ["CONNECTED", "OPENING"] },
                    channel: "whatsapp"
                }
            });

            if (whatsapps.length === 0) return;

            // Obter IDs das sessões ativas em memória (Baileys)
            const baileysSessionIds = getWbotSessionIds();
            
            // Obter adapters ativos (API Oficial)
            const officialAdapters = WhatsAppFactory.getActiveAdapters();
            const officialSessionIds = Array.from(officialAdapters.keys());

            // Combinar ambos os tipos de sessão
            const allActiveSessionIds = [...baileysSessionIds, ...officialSessionIds];

            for (const whatsapp of whatsapps) {
                // Verificar se sessão já está em processo de reconexão
                if (getWbotIsReconnecting(whatsapp.id)) {
                    logger.debug(`[OrphanedCron] Sessão ${whatsapp.name} (#${whatsapp.id}) já está reconectando. Pulando.`);
                    continue;
                }

                // Verificar se a sessão está ativa em memória (Baileys ou API Oficial)
                const isActive = allActiveSessionIds.includes(whatsapp.id);

                // Se NÃO está ativa em memória, mas o status é CONNECTED no banco,
                // significa que a sessão foi perdida. Tenta reconectar.
                if (!isActive) {
                    const sessionType = whatsapp.channelType === "official" ? "API Oficial" : "Baileys";
                    logger.info(`[OrphanedCron] Sessão ${sessionType} ${whatsapp.name} (#${whatsapp.id}) parece órfã (não está em memória). Tentando reconectar...`);
                    StartWhatsAppSessionUnified(whatsapp, whatsapp.companyId);
                } else {
                    logger.debug(`[OrphanedCron] Sessão ${whatsapp.name} (#${whatsapp.id}) está ativa em memória.`);
                }
            }
        } catch (err) {
            logger.error(`[OrphanedCron] Erro: ${err}`);
        }
    }, 30000); // 30s
};
