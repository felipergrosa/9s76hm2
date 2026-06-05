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

const numberFromEnv = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const isUsableAvatarUrl = (url: unknown): url is string => {
  if (typeof url !== "string") return false;

  const normalized = url.trim();
  if (!normalized || normalized === "changed") return false;
  if (normalized.includes("nopicture.png")) return false;

  return /^https?:\/\//i.test(normalized);
};

const uniqueValues = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeout: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

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
        attributes: ["id", "name", "number", "profilePicUrl", "remoteJid", "lidJid", "isGroup", "canonicalNumber"]
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
          attributes: ["id", "name", "number", "profilePicUrl", "remoteJid", "lidJid", "isGroup", "canonicalNumber"]
        });
      }
    }

    if (!contact && !targetJid) {
      return { success: false, updated: false, message: "Contato ou JID não encontrado" };
    }

    // Se temos contato mas não temos JID, construir a partir dos dados
    const targetJids = uniqueValues([
      targetJid,
      contact?.remoteJid?.includes("@") ? contact.remoteJid : null,
      contact?.lidJid?.includes("@") ? contact.lidJid : null,
      contact?.number ? `${String(contact.number).replace(/\D/g, "")}@s.whatsapp.net` : null,
      (contact as any)?.canonicalNumber ? `${String((contact as any).canonicalNumber).replace(/\D/g, "")}@s.whatsapp.net` : null
    ]);

    if (contact && !targetJid && targetJids.length > 0) {
      targetJid = targetJids[0];
    }

    if (targetJids.length === 0) {
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
      const storeContacts = (wbot as any)?.store?.contacts;

      for (const candidateJid of targetJids) {
        const storeContact = storeContacts?.[candidateJid];
        if (isUsableAvatarUrl(storeContact?.imgUrl)) {
          profilePicUrl = storeContact.imgUrl;
          break;
        }
      }

      const timeoutMs = numberFromEnv(process.env.AVATAR_PROFILE_FETCH_TIMEOUT_MS, 15000);

      if (!profilePicUrl) {
        for (const candidateJid of targetJids) {
          for (const profileType of ["image", "preview"] as const) {
            try {
              const fetchedUrl = await withTimeout(
                wbot.profilePictureUrl(candidateJid, profileType),
                timeoutMs,
                `Timeout ao buscar foto de perfil (${candidateJid}, ${profileType})`
              );

              if (isUsableAvatarUrl(fetchedUrl)) {
                profilePicUrl = fetchedUrl;
                break;
              }
            } catch (err: any) {
              logger.debug(`[RefreshAvatar] Erro ao buscar foto de ${candidateJid}/${profileType}: ${err?.message}`);
            }
          }

          if (profilePicUrl) break;
        }
      }

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
