import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import { hasPermission, hasAnyPermission, hasAllPermissions } from "../helpers/PermissionAdapter";
import User from "../models/User";

interface RequestWithUser extends Request {
  user?: {
    id: string;
    profile: string;
    companyId: number;
  };
}

/**
 * Middleware para verificar se usuário tem permissão específica
 * Uso: router.get("/rota", isAuth, checkPermission("users.view"), controller)
 */
export const checkPermission = (permission: string) => {
  return async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError("ERR_SESSION_EXPIRED", 401);
      }

      // Busca usuário completo do banco
      const user = await User.findByPk(req.user.id);
      
      if (!user) {
        throw new AppError("ERR_USER_NOT_FOUND", 404);
      }

      // Verifica permissão
      if (hasPermission(user, permission)) {
        return next();
      }

      throw new AppError("ERR_NO_PERMISSION", 403);
    } catch (err) {
      return next(err);
    }
  };
};

/**
 * Middleware para verificar se usuário tem QUALQUER uma das permissões
 * Uso: router.get("/rota", isAuth, checkAnyPermission(["users.view", "users.edit"]), controller)
 */
export const checkAnyPermission = (permissions: string[]) => {
  return async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError("ERR_SESSION_EXPIRED", 401);
      }

      const user = await User.findByPk(req.user.id);
      
      if (!user) {
        throw new AppError("ERR_USER_NOT_FOUND", 404);
      }

      if (hasAnyPermission(user, permissions)) {
        return next();
      }

      throw new AppError("ERR_NO_PERMISSION", 403);
    } catch (err) {
      return next(err);
    }
  };
};

/**
 * Middleware para verificar se usuário tem TODAS as permissões
 * Uso: router.post("/rota", isAuth, checkAllPermissions(["users.view", "users.edit"]), controller)
 */
export const checkAllPermissions = (permissions: string[]) => {
  return async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new AppError("ERR_SESSION_EXPIRED", 401);
      }

      const user = await User.findByPk(req.user.id);
      
      if (!user) {
        throw new AppError("ERR_USER_NOT_FOUND", 404);
      }

      if (hasAllPermissions(user, permissions)) {
        return next();
      }

      throw new AppError("ERR_NO_PERMISSION", 403);
    } catch (err) {
      return next(err);
    }
  };
};

/**
 * Middleware que adiciona o usuário completo ao request para controllers usarem
 * Útil quando controller precisa verificar permissões dinamicamente
 */
export const attachUserToRequest = async (
  req: RequestWithUser,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.id) {
      throw new AppError("ERR_SESSION_EXPIRED", 401);
    }

    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      throw new AppError("ERR_USER_NOT_FOUND", 404);
    }

    // Adiciona usuário completo ao request
    (req as any).fullUser = user;
    
    return next();
  } catch (err) {
    return next(err);
  }
};

export default checkPermission;
