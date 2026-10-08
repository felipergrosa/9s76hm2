import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import serviceTokenAuth from "../middleware/serviceTokenAuth";
import * as CallLogController from "../controllers/CallLogController";

const callLogRoutes = express.Router();

// Ingestão service-to-service (microserviço "wacalls" / SIP) — autenticação
// por X-Service-Token, NÃO por sessão de usuário. Sem isAuth de propósito.
callLogRoutes.post(
  "/call-logs",
  serviceTokenAuth,
  CallLogController.store
);

// Relatório de Chamadas (/call-report) — mesma permissão dos demais relatórios
callLogRoutes.get(
  "/call-logs",
  isAuth,
  checkPermission("reports.view"),
  CallLogController.index
);

callLogRoutes.get(
  "/call-logs/export",
  isAuth,
  checkPermission("reports.view"),
  CallLogController.exportCsv
);

export default callLogRoutes;
