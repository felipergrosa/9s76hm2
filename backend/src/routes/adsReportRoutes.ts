import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as AdsReportController from "../controllers/AdsReportController";

const adsReportRoutes = express.Router();

// Relatório de Anúncios Click-to-WhatsApp (CTWA) —
// requer permissão de visualização de relatórios
adsReportRoutes.get(
  "/ads-report",
  isAuth,
  checkPermission("reports.view"),
  AdsReportController.index
);

export default adsReportRoutes;
