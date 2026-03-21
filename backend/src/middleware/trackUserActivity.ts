import { Request, Response, NextFunction } from "express";
import User from "../models/User";
import UpdateUserOnlineStatusService from "../services/UserServices/UpdateUserOnlineStatusService";

/**
 * Middleware para rastrear atividade do usuário
 * Atualiza lastActivityAt a cada requisição autenticada
 * Se usuário estava offline, coloca online novamente
 */
const trackUserActivity = async (req: Request, res: Response, next: NextFunction) => {
  // Só processa requisições autenticadas
  if (!req.user?.id) {
    return next();
  }

  const userId = req.user.id;
  const companyId = req.user.companyId;

  // Atualiza lastActivityAt e verifica status de forma assíncrona
  (async () => {
    try {
      // Buscar status atual do usuário
      const user = await User.findByPk(userId, {
        attributes: ["id", "online", "lastActivityAt", "status"]
      });

      if (!user) return;

      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

      // Se usuário está offline ou inativo há mais de 3h, colocar online
      if (!user.online || user.lastActivityAt < threeHoursAgo) {
        console.log(`[TrackActivity] Usuário ${userId} voltando à atividade - online=${user.online}, lastActivity=${user.lastActivityAt}`);
        
        // Atualizar para online
        await User.update(
          { 
            online: true, 
            lastActivityAt: now,
            status: null // Limpar status "ausente" se existir
          },
          { where: { id: userId }, silent: true }
        );

        // Emitir evento Socket.IO para atualizar frontend
        await UpdateUserOnlineStatusService({
          userId,
          companyId,
          online: true
        });
      } else {
        // Apenas atualizar lastActivityAt
        await User.update(
          { lastActivityAt: now },
          { where: { id: userId }, silent: true }
        );
      }
    } catch (err) {
      console.error(`[TrackActivity] Erro ao rastrear atividade do usuário ${userId}:`, err);
    }
  })();

  return next();
};

export default trackUserActivity;
