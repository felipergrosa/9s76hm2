import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";

type TokenPayload = {
  token: string | undefined;
};

const envTokenAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { token: bodyToken } = req.body as TokenPayload;
    const { token: queryToken } = req.query as TokenPayload;

    // Token configurado via ENV_TOKEN
    const configuredToken = process.env.ENV_TOKEN;

    // Em desenvolvimento, aceitar token padrão "wtV" se ENV_TOKEN não estiver configurado
    const isDevelopment = process.env.NODE_ENV !== "production";
    const devFallbackToken = isDevelopment ? "wtV" : null;

    const validToken = configuredToken || devFallbackToken;

    if (!validToken) {
      throw new AppError("Token de ambiente não configurado", 500);
    }

    if (queryToken === validToken) {
      return next();
    }

    if (bodyToken === validToken) {
      return next();
    }
  } catch (e) {
    if (e instanceof AppError) throw e;
    // Não logar detalhes do erro para evitar exposição.
  }

  throw new AppError("Token inválido", 403);
};

export default envTokenAuth;