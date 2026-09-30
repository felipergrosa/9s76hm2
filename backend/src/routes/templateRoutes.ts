import express from "express";
import * as TemplateController from "../controllers/TemplateController";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

const templateRoutes = express.Router();

// GET /api/templates/:whatsappId/:templateName
// Busca definição de um template específico
templateRoutes.get(
    "/templates/:whatsappId/:templateName",
    isAuth,
    checkPermission("meta-templates.view"),
    TemplateController.getTemplateDefinition
);

export default templateRoutes;
