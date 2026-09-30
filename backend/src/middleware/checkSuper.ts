import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import User from "../models/User";

/**
 * Middleware N2: exige que o usuário autenticado seja super admin.
 * Consulta o usuário FRESCO no banco — não confia apenas na flag do JWT,
 * que pode estar desatualizada ou forjada em tokens antigos.
 * Uso: router.post("/rota", isAuth, checkSuper, controller)
 */
const checkSuper = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new AppError("ERR_SESSION_EXPIRED", 401);
    }

    const user = await User.findByPk(req.user.id);

    if (!user) {
      throw new AppError("ERR_USER_NOT_FOUND", 404);
    }

    if (user.super !== true) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

export default checkSuper;
