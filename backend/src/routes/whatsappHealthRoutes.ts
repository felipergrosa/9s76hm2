import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as WhatsappHealthController from "../controllers/WhatsappHealthController";

const whatsappHealthRoutes = express.Router();

// Painel "Saúde dos Números": qualidade/limite/status das conexões WABA.
// Consulta on-demand à Graph API — erros por número vêm no campo `error`.
whatsappHealthRoutes.get(
  "/whatsapp-health",
  isAuth,
  checkPermission("connections.view"),
  WhatsappHealthController.index
);

export default whatsappHealthRoutes;
