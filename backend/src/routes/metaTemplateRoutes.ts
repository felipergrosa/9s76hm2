import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as MetaTemplateController from "../controllers/MetaTemplateController";

const metaTemplateRoutes = express.Router();

// Upload em memória para mídia do HEADER do template (campo "headerFile")
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

// Lista/sincroniza templates da Meta para uma conexão WhatsApp oficial
metaTemplateRoutes.get(
  "/meta-templates/:whatsappId",
  isAuth,
  checkPermission("meta-templates.view"),
  MetaTemplateController.index
);

// Cria template na Meta (aceita multipart com headerFile)
metaTemplateRoutes.post(
  "/meta-templates/:whatsappId",
  isAuth,
  checkPermission("meta-templates.create"),
  upload.single("headerFile"),
  MetaTemplateController.store
);

// Atualiza template existente na Meta
metaTemplateRoutes.put(
  "/meta-templates/:whatsappId/:templateId",
  isAuth,
  checkPermission("meta-templates.edit"),
  MetaTemplateController.update
);

// Remoção em massa — declarada ANTES de /:templateId para não conflitar
metaTemplateRoutes.delete(
  "/meta-templates/:whatsappId/bulk",
  isAuth,
  checkPermission("meta-templates.delete"),
  MetaTemplateController.removeBulk
);

// Remove um template (a Meta exige o name via query)
metaTemplateRoutes.delete(
  "/meta-templates/:whatsappId/:templateId",
  isAuth,
  checkPermission("meta-templates.delete"),
  MetaTemplateController.remove
);

export default metaTemplateRoutes;
