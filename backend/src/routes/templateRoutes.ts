import express from "express";
import * as TemplateController from "../controllers/TemplateController";
import isAuth from "../middleware/isAuth";

const templateRoutes = express.Router();

// GET /api/templates/:whatsappId/:templateName
// Busca definição de um template específico
templateRoutes.get(
    "/templates/:whatsappId/:templateName",
    isAuth,
    TemplateController.getTemplateDefinition
);

export default templateRoutes;
