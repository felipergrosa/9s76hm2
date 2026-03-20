import User from "../../models/User";
import { getIO } from "../../libs/socket";

/**
 * Atualiza status online do usuário de forma assíncrona
 * Não bloqueia requisições HTTP
 */
interface Request {
  userId: string | number;
  companyId: string | number;
  online?: boolean;
}

const UpdateUserOnlineStatusService = async ({
  userId,
  companyId,
  online = true
}: Request): Promise<void> => {
  try {
    const user = await User.findOne({
      where: { id: userId, companyId },
      attributes: ["id", "online", "updatedAt"]
    });

    if (!user) {
      console.warn(`[UpdateUserOnlineStatus] Usuário ${userId} não encontrado`);
      return;
    }

    // Só atualiza se status mudou
    if (user.online === online) {
      // Apenas atualiza updatedAt
      await user.update({ updatedAt: new Date() }, { silent: true });
      return;
    }

    // Atualiza status online
    await user.update({ online, updatedAt: new Date(), lastActivityAt: online ? new Date() : user.lastActivityAt });

    // Emite evento Socket.IO com dados completos do usuário
    const io = getIO();
    
    // Busca dados atualizados do usuário para emitir
    const updatedUser = await User.findByPk(userId, {
      attributes: ["id", "name", "email", "profile", "online", "companyId", "profileImage", "startWork", "endWork", "lastActivityAt", "status"]
    });
    
    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-user`, {
        action: "update",
        user: {
          ...updatedUser.toJSON(),
          online: online  // Garante que o campo online está presente
        }
      });

    console.log(`[UpdateUserOnlineStatus] Usuário ${userId} → online=${online}`);
  } catch (error) {
    console.error(`[UpdateUserOnlineStatus] Erro ao atualizar usuário ${userId}:`, error);
  }
};

export default UpdateUserOnlineStatusService;
