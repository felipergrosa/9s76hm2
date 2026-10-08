import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as ClosingReportController from "../controllers/ClosingReportController";

const closingReportRoutes = express.Router();

// Relatório de Fechamento — requer permissão de visualização de relatórios
closingReportRoutes.get(
  "/closing-report",
  isAuth,
  checkPermission("reports.view"),
  ClosingReportController.index
);

closingReportRoutes.get(
  "/closing-report/export",
  isAuth,
  checkPermission("reports.view"),
  ClosingReportController.exportCsv
);

export default closingReportRoutes;
