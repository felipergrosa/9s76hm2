import { Request, Response, NextFunction } from "express";
import AppError from "../../errors/AppError";
import {
  hasPermissionAsync,
  hasAnyPermissionAsync,
  hasAllPermissionsAsync
} from "./resolver";
import User from "../../models/User";
import { withCache } from "../../utils/serviceCache";

/**
 * Guards de autorização para rotas Express.
 *
 * Extraídos de middleware/checkPermission.ts — aqui ficam os middlewares
 * que buscam o usuário FRESCO do DB (com cache curto) e verificam
 * permissões granulares (incluindo Roles) antes do controller.
 */

// Cache curto (30s) do usuário para evitar um SELECT a cada requisição autenticada.
// Invalidado nos pontos que alteram o usuário (UpdateUserService, avatar, delete, etc).
const USER_CACHE_TTL = 30 * 1000;
const getCachedUser = (id: string) =>
  withCache(
    `user:${id}`,
    async () => {
      // await dentro do async garante Promise nativa (findByPk retorna Bluebird)
      const user = await User.findByPk(id);
      return user;
    },
    USER_CACHE_TTL
  );

interface RequestWithUser extends Request {
  user?: {
    id: string;
    profile: string;
    companyId: number;
  };
}

// checkAdminOrSuper removido: rotas migradas para checkPermission() granular
// (settings.edit / financeiro.edit / contacts.edit-tags conforme o domínio).

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
      const user = await getCachedUser(req.user.id);
      
      if (!user) {
        throw new AppError("ERR_USER_NOT_FOUND", 404);
      }

      // Verifica permissão (inclui Roles atribuídas via item 11 do plano)
      if (await hasPermissionAsync(user, permission)) {
        return next();
      }

      throw new AppError(`ERR_NO_PERMISSION: ${permission}`, 403);
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

      const user = await getCachedUser(req.user.id);
      
      if (!user) {
        throw new AppError("ERR_USER_NOT_FOUND", 404);
      }

      if (await hasAnyPermissionAsync(user, permissions)) {
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

      const user = await getCachedUser(req.user.id);
      
      if (!user) {
        throw new AppError("ERR_USER_NOT_FOUND", 404);
      }

      if (await hasAllPermissionsAsync(user, permissions)) {
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

    const user = await getCachedUser(req.user.id);
    
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
