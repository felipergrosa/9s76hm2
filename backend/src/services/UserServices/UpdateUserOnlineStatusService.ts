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
    await user.update({ online, updatedAt: new Date() });

    // Emite evento Socket.IO
    const io = getIO();
    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-user`, {
        action: "update",
        user: {
          id: user.id,
          online
        }
      });

    console.log(`[UpdateUserOnlineStatus] Usuário ${userId} → online=${online}`);
  } catch (error) {
    console.error(`[UpdateUserOnlineStatus] Erro ao atualizar usuário ${userId}:`, error);
  }
};

export default UpdateUserOnlineStatusService;
