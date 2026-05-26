import { Request, Response, NextFunction } from "express";
import User from "../models/User";
import UpdateUserOnlineStatusService from "../services/UserServices/UpdateUserOnlineStatusService";

// Map em memória para throttle de atualizações de atividade do usuário
// Chave: userId, Valor: timestamp da última atualização
const userActivityThrottleMap = new Map<number | string, number>();
const ACTIVITY_THROTTLE_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Middleware para rastrear atividade do usuário
 * Atualiza lastActivityAt a cada requisição autenticada (com throttle de 5 minutos)
 * Se usuário estava offline, coloca online novamente
 */
const trackUserActivity = async (req: Request, res: Response, next: NextFunction) => {
  // Só processa requisições autenticadas
  if (!req.user?.id) {
    return next();
  }

  const userId = req.user.id;
  const companyId = req.user.companyId;

  // Verifica throttle antes de consultar ou atualizar o banco de dados
  const nowMs = Date.now();
  const lastUpdate = userActivityThrottleMap.get(userId) || 0;

  if (nowMs - lastUpdate < ACTIVITY_THROTTLE_MS) {
    // Menos de 5 minutos desde a última atualização, pula processamento de banco
    return next();
  }

  // Atualiza o throttle map imediatamente para evitar race conditions em requisições paralelas
  userActivityThrottleMap.set(userId, nowMs);

  // Atualiza lastActivityAt e verifica status de forma assíncrona
  (async () => {
    try {
      // Buscar status atual do usuário
      const user = await User.findByPk(userId, {
        attributes: ["id", "online", "lastActivityAt", "status"]
      });

      if (!user) {
        return;
      }

      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

      // Se usuário está offline ou inativo há mais de 3h, colocar online
      if (!user.online || !user.lastActivityAt || user.lastActivityAt < threeHoursAgo) {
        console.log(`[TrackActivity] Usuário ${userId} voltando à atividade - online=${user.online}`);
        
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
      // Remove do cache em caso de erro para tentar na próxima requisição
      userActivityThrottleMap.delete(userId);
    }
  })();

  return next();
};

export default trackUserActivity;
