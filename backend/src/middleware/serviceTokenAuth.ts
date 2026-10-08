import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";

/**
 * Autenticação service-to-service para endpoints consumidos por microserviços
 * internos (ex.: "wacalls" que reporta logs de chamadas — POST /call-logs).
 *
 * Compara o header `X-Service-Token` com a env INTERNAL_SERVICE_TOKEN.
 * - Env ausente → 503 (falha fechada: sem segredo configurado não há como autenticar)
 * - Token divergente/ausente → 403
 *
 * O token só é aceito via header — nunca por query (?token=), que vaza em
 * logs de proxy. Não usar para endpoints de usuário final (esses passam por
 * isAuth + checkPermission).
 */
const serviceTokenAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const configuredToken = process.env.INTERNAL_SERVICE_TOKEN;

  if (!configuredToken) {
    throw new AppError(
      "Autenticação de serviço não configurada (INTERNAL_SERVICE_TOKEN ausente)",
      503
    );
  }

  const headerToken = req.headers["x-service-token"];
  const providedToken =
    typeof headerToken === "string" ? headerToken : undefined;

  if (providedToken && providedToken === configuredToken) {
    return next();
  }

  throw new AppError("Token de serviço inválido", 403);
};

export default serviceTokenAuth;
