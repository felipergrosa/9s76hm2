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

    // Não logar req.query/req.body (podem conter tokens).
    if (!process.env.ENV_TOKEN) {
      throw new AppError("Token de ambiente não configurado", 500);
    }

    if (queryToken === process.env.ENV_TOKEN) {
      return next();
    }

    if (bodyToken === process.env.ENV_TOKEN) {
      return next();
    }
  } catch (e) {
    if (e instanceof AppError) throw e;
    // Não logar detalhes do erro para evitar exposição.
  }

  throw new AppError("Token inválido", 403);
};

export default envTokenAuth;