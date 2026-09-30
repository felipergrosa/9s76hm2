import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";

const envTokenAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Token configurado exclusivamente via ENV_TOKEN — sem fallback público.
  const configuredToken = process.env.ENV_TOKEN;

  if (!configuredToken) {
    // Falha fechada: sem ENV_TOKEN configurado não há como autenticar.
    throw new AppError("Autenticação por token de ambiente não configurada", 503);
  }

  // Token aceito apenas via header. Query (?token=) vaza em logs de proxy
  // e body não se aplica a GETs — ambos removidos por segurança.
  const headerToken = req.headers["x-env-token"];
  const authHeader = req.headers.authorization;
  const bearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : undefined;

  const providedToken =
    (typeof headerToken === "string" ? headerToken : undefined) || bearerToken;

  if (providedToken && providedToken === configuredToken) {
    return next();
  }

  throw new AppError("Token inválido", 403);
};

export default envTokenAuth;
