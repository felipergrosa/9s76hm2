import { verify } from "jsonwebtoken";
import { Response as Res } from "express";

import AppError from "../../errors/AppError";
import ShowUserService from "../UserServices/ShowUserService";
import { SerializeUser } from "../../helpers/SerializeUser";
import authConfig from "../../config/auth";
import {
  createAccessToken,
  createRefreshToken
} from "../../helpers/CreateTokens";

interface RefreshTokenPayload {
  id: string;
  tokenVersion: number;
  companyId: number;
}

interface Response {
  user: Awaited<ReturnType<typeof SerializeUser>>;
  newToken: string;
  refreshToken: string;
}

export const RefreshTokenService = async (
  res: Res,
  token: string
): Promise<Response> => {
  try {
    const decoded = verify(token, authConfig.refreshSecret);
    const { id, tokenVersion, companyId } = decoded as RefreshTokenPayload;

    const user = await ShowUserService(id, companyId);

    if (user.tokenVersion !== tokenVersion) {
      res.clearCookie("jrt");
      throw new AppError("ERR_SESSION_EXPIRED", 401);
    }

    const newToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    // Serializa igual ao login (AuthUserService): devolve o set EFETIVO de
    // permissões (base + flags + ACL + Roles) em user.permissions. Retornar
    // o model cru expõe apenas a coluna ACL pontual e o frontend perde
    // todas as permissões granulares a cada F5.
    const serializedUser = await SerializeUser(user);

    return { user: serializedUser, newToken, refreshToken };
  } catch (err) {
    res.clearCookie("jrt");
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }
};
