import { Request, Response } from "express";
import RefreshContactAvatarRealtimeService from "../services/ContactServices/RefreshContactAvatarRealtimeService";
import GetDefaultWhatsApp from "../helpers/GetDefaultWhatsApp";
import logger from "../utils/logger";

/**
 * Controller para atualização em tempo real da foto de perfil de um contato
 * Busca a foto mais recente via API do WhatsApp (Baileys)
 */
export const refreshContactAvatar = async (req: Request, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { jid } = req.query;
  const companyId = req.user.companyId;

  logger.info(`[refreshContactAvatar] Solicitação para atualizar avatar: contactId=${contactId}, jid=${jid}`);

  try {
    // Buscar WhatsApp padrão da empresa
    const defaultWhatsapp = await GetDefaultWhatsApp(null, companyId);
    if (!defaultWhatsapp) {
      return res.status(400).json({
        success: false,
        message: "Nenhuma conexão WhatsApp encontrada"
      });
    }

    const result = await RefreshContactAvatarRealtimeService({
      contactId: contactId ? Number(contactId) : undefined,
      jid: jid ? String(jid) : undefined,
      companyId,
      whatsappId: defaultWhatsapp.id
    });

    if (result.success) {
      return res.status(200).json({
        success: true,
        profilePicUrl: result.profilePicUrl,
        updated: result.updated,
        message: result.updated ? "Avatar atualizado com sucesso" : "Avatar já está atualizado"
      });
    }

    return res.status(400).json({
      success: false,
      message: result.message || "Não foi possível atualizar o avatar"
    });
  } catch (err: any) {
    logger.error(`[refreshContactAvatar] Erro: ${err?.message}`);
    return res.status(500).json({
      success: false,
      message: "Erro interno ao atualizar avatar"
    });
  }
};

export default refreshContactAvatar;
