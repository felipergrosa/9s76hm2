import { Router } from "express";
import isAuth from "../middleware/isAuth";

import WhatsAppSessionController from "../controllers/WhatsAppSessionController";

const whatsappSessionRoutes = Router();

whatsappSessionRoutes.post(
  "/whatsappsession/:whatsappId",
  isAuth,
  WhatsAppSessionController.store
);

whatsappSessionRoutes.put(
  "/whatsappsession/:whatsappId",
  isAuth,
  WhatsAppSessionController.update
);

whatsappSessionRoutes.delete(
  "/whatsappsession/:whatsappId",
  isAuth,
  WhatsAppSessionController.remove
);

// Limpar sessão criptográfica de contato específico (resolve Bad MAC errors)
whatsappSessionRoutes.post(
  "/whatsappsession/:whatsappId/clear-contact-session",
  isAuth,
  WhatsAppSessionController.clearContactSession
);

export default whatsappSessionRoutes;
