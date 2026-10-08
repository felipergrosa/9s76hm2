import { Router } from "express";
import * as AccountSwitchController from "../controllers/AccountSwitchController";
import isAuth from "../middleware/isAuth";
import { loginRateLimit } from "../middleware/rateLimit";

// Rotas de "Trocar de conta" (referência Fluxoo /account-switch).
// Caminhos completos (/auth/...) dentro do próprio router para o wiring ser
// uma linha única e inequívoca em routes/index.ts:
//   import accountSwitchRoutes from "./accountSwitchRoutes";
//   routes.use(accountSwitchRoutes);
const accountSwitchRoutes = Router();

// Lista de contas alternáveis exige sessão válida — a resposta já é mínima
// (só nome da empresa + userId/profile), mas nunca deve ser pública.
accountSwitchRoutes.get(
  "/auth/switchable-accounts",
  isAuth,
  AccountSwitchController.index
);

// Switch reusa o rate limit do login (10/min por IP): operação sensível de
// autenticação — sem limit, um token vazado poderia enumerar/trocar tenants
// em loop. isAuth roda depois para pouparmos a verificação em tráfego abusivo.
accountSwitchRoutes.post(
  "/auth/switch",
  loginRateLimit,
  isAuth,
  AccountSwitchController.switchAccount
);

export default accountSwitchRoutes;
