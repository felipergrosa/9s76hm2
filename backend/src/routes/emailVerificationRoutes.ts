import { Router } from "express";
import * as EmailVerificationController from "../controllers/EmailVerificationController";
import { verifyEmailRateLimit } from "../middleware/rateLimit";

// Rotas públicas de verificação de e-mail no signup (código de 6 dígitos).
// PENDENTE: registrar este router em src/routes/index.ts com
//   import emailVerificationRoutes from "./emailVerificationRoutes";
//   routes.use(emailVerificationRoutes);
const emailVerificationRoutes = Router();

// Rate-limit por IP + limites por e-mail dentro do service
// (cooldown 60s e máx. 5 envios/hora).
emailVerificationRoutes.post(
  "/auth/verify-email/send",
  verifyEmailRateLimit,
  EmailVerificationController.send
);
emailVerificationRoutes.post(
  "/auth/verify-email/check",
  verifyEmailRateLimit,
  EmailVerificationController.check
);

export default emailVerificationRoutes;
