import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import User from "../models/User";

/**
 * @deprecated Use checkAdminOrSuper() de checkPermission.ts ao invés.
 * Este middleware será removido em versão futura.
 * Diferença: isSuper retorna 401, checkAdminOrSuper retorna 403 (correto).
 */
const isSuper = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  console.warn("[DEPRECATED] isSuper middleware está deprecado. Use checkAdminOrSuper() ao invés.");
  const { super: isSuper } = await User.findByPk(req.user.id);
  if (!isSuper) {
    throw new AppError(
      "Acesso não permitido",
      401
    );
  }

  return next();
}

export default isSuper;
