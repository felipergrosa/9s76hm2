import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import { withCache } from "../utils/serviceCache";

const isAuthApi = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const [, token] = authHeader.split(" ");
  try {
    // Cache curto (60s) token -> whatsapp para evitar query a cada request da API externa.
    // Invalidado em UpdateWhatsAppService/UpdateWhatsAppServiceAdmin/DeleteWhatsAppService.
    const whatsapp = await withCache(
      `whatsappToken:${token}`,
      async () => {
        // await dentro do async garante Promise nativa (findOne retorna Bluebird)
        const wpp = await Whatsapp.findOne({ where: { token } });
        return wpp;
      },
      60 * 1000
    );

    const getToken = whatsapp?.token;
    if (!getToken) {
      throw new AppError("ERR_SESSION_EXPIRED", 401);
    }

    if (getToken !== token) {
      throw new AppError("ERR_SESSION_EXPIRED", 401);
    }
  } catch (err) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  return next();
};

export default isAuthApi;
