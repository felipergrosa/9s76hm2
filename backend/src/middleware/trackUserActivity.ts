import { Request, Response, NextFunction } from "express";
import User from "../models/User";

/**
 * Middleware para rastrear atividade do usuário
 * Atualiza lastActivityAt a cada requisição autenticada
 */
const trackUserActivity = async (req: Request, res: Response, next: NextFunction) => {
  // Só processa requisições autenticadas
  if (!req.user?.id) {
    return next();
  }

  // Atualiza lastActivityAt de forma assíncrona (não bloqueia a requisição)
  User.update(
    { lastActivityAt: new Date() },
    { where: { id: req.user.id }, silent: true }
  ).catch(err => {
    console.error(`[TrackActivity] Erro ao atualizar lastActivityAt para usuário ${req.user.id}:`, err);
  });

  return next();
};

export default trackUserActivity;
