import express from "express";
import isAuth from "../middleware/isAuth";
import * as AuditLogController from "../controllers/AuditLogController";
import { checkPermission } from "../middleware/checkPermission";

const auditLogRoutes = express.Router();

// Rotas disponíveis apenas para quem tem permissão
auditLogRoutes.get("/audit-logs", 
  isAuth, 
  checkPermission("settings.view"), // Apenas admin ou quem tem permissão de settings
  AuditLogController.index
);

auditLogRoutes.get("/audit-logs/export", 
  isAuth, 
  checkPermission("settings.view"),
  AuditLogController.exportCsv
);

export default auditLogRoutes;
