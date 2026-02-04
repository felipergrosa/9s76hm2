import { verify } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";
import authConfig from "../config/auth";

import { updateUser } from "../helpers/updateUser";

// Interface para Request estendido
interface ExtendedRequest extends Request {
  user?: {
    id: string;
    profile: string;
    companyId: number;
    super: boolean;
  };
}

interface TokenPayload {
  id: string;
  username: string;
  profile: string;
  companyId: number;
  super: boolean;
  iat: number;
  exp: number;
}

const isAuth = async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const [, token] = authHeader.split(" ");

  try {
    const decoded = verify(token, authConfig.secret) as TokenPayload;
    const { id, profile, companyId, super: superUser } = decoded;

    // Atualização do usuário
    await updateUser(id, companyId);

    // Adição segura do usuário ao request
    req.user = {
      id,
      profile,
      companyId,
      super: superUser
    };

    return next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError("ERR_SESSION_EXPIRED", 401);
    } else if (err.name === 'JsonWebTokenError') {
      throw new AppError(
        "Invalid token. We'll try to assign a new one on next request",
        403
      );
    }

    // Erro genérico
    throw new AppError("Authentication failed", 401);
  }
};

export default isAuth;
