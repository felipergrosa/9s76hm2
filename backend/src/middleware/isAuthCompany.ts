import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";

import AppError from "../errors/AppError";

const isAuthCompany = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization || "";
  const match = /^Bearer ([^\s]+)$/i.exec(authHeader);
  if (!match) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }
  const configuredToken = process.env.COMPANY_TOKEN;
  if (!configuredToken) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }
  const supplied = Buffer.from(match[1]);
  const expected = Buffer.from(configuredToken);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }
  return next();
};

export default isAuthCompany;
