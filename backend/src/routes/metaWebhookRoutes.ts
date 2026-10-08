import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as MetaWebhookConfigController from "../controllers/MetaWebhookConfigController";

const metaWebhookRoutes = Router();

// Config de setup do webhook Meta (URL + verify token mascarado + campos).
// Somente leitura de metadados — tokens/secrets nunca saem completos.
metaWebhookRoutes.get(
  "/meta-webhook-config",
  isAuth,
  checkPermission("settings.view"),
  MetaWebhookConfigController.index
);

export default metaWebhookRoutes;
