import { getWbotOrRecover } from "../../libs/wbot";
import Contact from "../../models/Contact";
import LidMapping from "../../models/LidMapping";
import logger from "../../utils/logger";
import { Op } from "sequelize";

/**
 * Serviço para buscar e atualizar a foto de perfil de um contato em tempo real
 * via API do WhatsApp (Baileys)
 */
interface RefreshContactAvatarRequest {
  contactId?: number;
  jid?: string;
  companyId: number;
  whatsappId: number;
}

interface RefreshContactAvatarResponse {
  success: boolean;
  profilePicUrl?: string;
  updated: boolean;
  message?: string;
}

export const RefreshContactAvatarService = async ({
  contactId,
  jid,
  companyId,
  whatsappId
}: RefreshContactAvatarRequest): Promise<RefreshContactAvatarResponse> => {
  try {
    let contact: Contact | null = null;
    let targetJid: string | null = null;

    // Se temos contactId, buscar o contato
    if (contactId) {
      contact = await Contact.findOne({
        where: { id: contactId, companyId },
        attributes: ["id", "name", "number", "profilePicUrl", "remoteJid", "lidJid", "isGroup"]
      });
    }

    // Se temos JID direto
    if (jid) {
      targetJid = jid.includes("@") ? jid : `${jid}@s.whatsapp.net`;
      
      // Se não temos contact, buscar por JID
      if (!contact) {
        contact = await Contact.findOne({
          where: {
            companyId,
            [Op.or]: [
              { remoteJid: targetJid },
              { lidJid: targetJid },
              { number: jid.replace(/\D/g, "") }
            ]
          },
          attributes: ["id", "name", "number", "profilePicUrl", "remoteJid", "lidJid", "isGroup"]
        });
      }
    }

    if (!contact && !targetJid) {
      return { success: false, updated: false, message: "Contato ou JID não encontrado" };
    }

    // Se temos contato mas não temos JID, construir a partir dos dados
    if (contact && !targetJid) {
      if (contact.remoteJid && contact.remoteJid.includes("@s.whatsapp.net")) {
        targetJid = contact.remoteJid;
      } else if (contact.lidJid && contact.lidJid.includes("@lid")) {
        targetJid = contact.lidJid;
      } else if (contact.number) {
        targetJid = `${contact.number}@s.whatsapp.net`;
      }
    }

    if (!targetJid) {
      return { success: false, updated: false, message: "Não foi possível determinar o JID do contato" };
    }

    // Obter instância do WhatsApp
    const wbot = await getWbotOrRecover(whatsappId);
    if (!wbot) {
      return { success: false, updated: false, message: "Conexão WhatsApp não disponível" };
    }

    // Buscar foto do perfil via Baileys
    // PROTEÇÃO: Timeout para prevenir travamento do websocket durante HTTP request
    let profilePicUrl: string | null = null;
    try {
      profilePicUrl = await Promise.race([
        wbot.profilePictureUrl(targetJid, "image"),
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout ao buscar foto de perfil')), 5000)
        )
      ]);
      logger.info(`[RefreshAvatar] Foto obtida para ${targetJid}: ${profilePicUrl ? "OK" : "N/A"}`);
    } catch (err: any) {
      // Erro comum quando o contato tem privacidade ativada ou timeout
      logger.debug(`[RefreshAvatar] Erro ao buscar foto de ${targetJid}: ${err?.message}`);
    }

    // Se conseguimos uma URL e é diferente da atual, atualizar
    if (profilePicUrl && profilePicUrl !== contact?.profilePicUrl) {
      if (contact) {
        await contact.update({ profilePicUrl });
        logger.info(`[RefreshAvatar] Foto atualizada para ${contact.name} (${targetJid})`);
      }
      return { success: true, profilePicUrl, updated: true };
    }

    // Se não conseguimos URL nova, mas já temos uma, manter a atual
    if (!profilePicUrl && contact?.profilePicUrl) {
      return { success: true, profilePicUrl: contact.profilePicUrl, updated: false };
    }

    return { success: true, profilePicUrl, updated: false };
  } catch (err: any) {
    logger.error(`[RefreshAvatar] Erro: ${err?.message}`);
    return { success: false, updated: false, message: err?.message };
  }
};

export default RefreshContactAvatarService;
