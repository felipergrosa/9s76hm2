import { Op } from "sequelize";
import Whatsapp from "../models/Whatsapp";
import logger from "../utils/logger";
import { StartWhatsAppSessionUnified } from "../services/WbotServices/StartWhatsAppSessionUnified";
import { getLockKey } from "../libs/wbotMutex";
import cacheLayer from "../libs/cache";
import { getWbotIsReconnecting } from "../libs/wbot";

export const checkOrphanedSessionsCron = () => {
    // Intervalo de verificação: 10 segundos
    setInterval(async () => {
        try {
            const whatsapps = await Whatsapp.findAll({
                where: {
                    status: { [Op.or]: ["CONNECTED", "OPENING"] },
                    channel: "whatsapp"
                }
            });

            if (whatsapps.length === 0) return;

            const redis = cacheLayer.getRedisInstance();
            if (!redis) return; // Se não tem redis, não tem como checar lock

            for (const whatsapp of whatsapps) {
                // CORREÇÃO: Verificar se sessão já está em processo de reconexão
                // Isso evita race condition onde OrphanedCron tenta assumir durante delay de reconexão
                if (getWbotIsReconnecting(whatsapp.id)) {
                    logger.debug(`[OrphanedCron] Sessão ${whatsapp.name} (#${whatsapp.id}) já está reconectando. Pulando.`);
                    continue;
                }

                const key = getLockKey(whatsapp.id);
                const owner = await redis.get(key);

                // Se NÃO tem dono (lock expirou ou foi apagado), mas o status é CONNECTED no banco,
                // significa que o nó que cuidava caiu. Tenta assumir.
                if (!owner) {
                    logger.info(`[OrphanedCron] Sessão ${whatsapp.name} (#${whatsapp.id}) parece órfã (sem lock). Tentando assumir...`);
                    StartWhatsAppSessionUnified(whatsapp, whatsapp.companyId);
                }
            }
        } catch (err) {
            logger.error(`[OrphanedCron] Erro: ${err}`);
        }
    }, 10000); // 10s
};
