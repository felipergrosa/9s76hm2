import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import WhatsAppSessionController from "../controllers/WhatsAppSessionController";

const whatsappSessionRoutes = Router();

whatsappSessionRoutes.post(
  "/whatsappsession/:whatsappId",
  isAuth,
  checkPermission("connections.create"),
  WhatsAppSessionController.store
);

whatsappSessionRoutes.put(
  "/whatsappsession/:whatsappId",
  isAuth,
  checkPermission("connections.edit"),
  WhatsAppSessionController.update
);

whatsappSessionRoutes.delete(
  "/whatsappsession/:whatsappId",
  isAuth,
  checkPermission("connections.delete"),
  WhatsAppSessionController.remove
);

// Limpar sessão criptográfica de contato específico (resolve Bad MAC errors)
whatsappSessionRoutes.post(
  "/whatsappsession/:whatsappId/clear-contact-session",
  isAuth,
  checkPermission("connections.edit"),
  WhatsAppSessionController.clearContactSession
);

// Limpar apenas arquivos da sessão (mantém conexão no banco)
whatsappSessionRoutes.post(
  "/whatsappsession/:whatsappId/clear-files",
  isAuth,
  checkPermission("connections.edit"),
  WhatsAppSessionController.clearWhatsAppSession
);

export default whatsappSessionRoutes;
