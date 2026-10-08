import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { getIO } from "../libs/socket";
import { SendRefreshToken } from "../helpers/SendRefreshToken";
import {
  ListSwitchableAccountsService,
  SwitchAccountService
} from "../services/AuthServices/AccountSwitchService";
import UpdateUserOnlineStatusService from "../services/UserServices/UpdateUserOnlineStatusService";

// GET /auth/switchable-accounts — lista as empresas para as quais o usuário
// logado pode alternar (mesmo e-mail cadastrado como User em outro tenant).
export const index = async (req: Request, res: Response): Promise<Response> => {
  const accounts = await ListSwitchableAccountsService(req.user.id);

  return res.status(200).json(accounts);
};

// POST /auth/switch { companyId } — alterna a sessão para o usuário de mesmo
// e-mail na empresa alvo, reemitindo access + refresh token.
export const switchAccount = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.body;

  // Validação de entrada: companyId inteiro positivo (rejeita string solta,
  // negativo, zero, objeto — o service só recebe número válido).
  const targetCompanyId = Number(companyId);
  if (!Number.isInteger(targetCompanyId) || targetCompanyId <= 0) {
    throw new AppError("ERR_ACCOUNT_SWITCH_INVALID_COMPANY", 400);
  }

  const { token, refreshToken, serializedUser } = await SwitchAccountService(
    req.user.id,
    targetCompanyId
  );

  // Mesmo cookie de refresh do login (jrt) — sem ele a próxima chamada a
  // /auth/refresh_token falharia e a sessão cairia no reload do frontend.
  SendRefreshToken(res, refreshToken);

  // Marca o usuário da empresa alvo como online (paridade com o login).
  await UpdateUserOnlineStatusService({
    userId: serializedUser.id,
    companyId: serializedUser.companyId,
    online: true
  });

  // Mesmo evento do login: derruba outras sessões abertas desse usuário na
  // empresa alvo (frontend exibe "conta acessada em outro computador").
  // O namespace correto é /workspace-N — o frontend conecta nesse formato
  // (SessionController.store usa io.of("N"), que não alcança os clientes).
  // SEGURANÇA: nunca emitir token via socket — só dados mínimos.
  const io = getIO();
  io.of(`/workspace-${serializedUser.companyId}`).emit(
    `company-${serializedUser.companyId}-auth`,
    {
      action: "update",
      user: {
        id: serializedUser.id,
        email: serializedUser.email,
        companyId: serializedUser.companyId
      }
    }
  );

  return res.status(200).json({
    token,
    user: serializedUser
  });
};
