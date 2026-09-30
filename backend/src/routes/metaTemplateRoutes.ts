import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as MetaTemplateController from "../controllers/MetaTemplateController";

const metaTemplateRoutes = express.Router();

// Upload em DISCO para mídia do HEADER do template (campo "headerFile").
// memoryStorage manteria até 100MB por upload em RAM — vetor de exaustão.
// O arquivo já cai na pasta final do tenant; o controller só lê e registra o path.
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.resolve("public", `company${(req.user as any).companyId}`, "meta-templates");
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const safeName = `${Date.now()}_${String(file.originalname).replace(/[^\w.\-]/g, "_")}`;
      cb(null, safeName);
    }
  }),
  // Vídeos de header da Meta podem ser grandes — manter 100MB
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Whitelist de MIME aceitos para mídia de HEADER de template
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "application/pdf"
    ];
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith("audio/")) {
      return cb(null, true);
    }
    return cb(new Error(`Tipo de arquivo não permitido para header de template: ${file.mimetype}`));
  }
});

// Tarifas por envio (pricing_analytics) — antes de /:whatsappId para não conflitar
metaTemplateRoutes.get(
  "/meta-templates/:whatsappId/pricing",
  isAuth,
  checkPermission("meta-templates.view"),
  MetaTemplateController.pricing
);

// Força re-sync das tarifas com a Meta
metaTemplateRoutes.post(
  "/meta-templates/:whatsappId/pricing/sync",
  isAuth,
  checkPermission("meta-templates.view"),
  MetaTemplateController.pricingSync
);

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

// Atualiza template existente na Meta (aceita multipart com headerFile)
metaTemplateRoutes.put(
  "/meta-templates/:whatsappId/:templateId",
  isAuth,
  checkPermission("meta-templates.edit"),
  upload.single("headerFile"),
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
