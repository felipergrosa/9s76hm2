import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import { cleanFlowbuilderOrphans } from "../controllers/MaintenanceController";

const maintenanceRoutes = express.Router();

// Rotina de manutenção/limpeza = configuração da empresa → settings.edit
maintenanceRoutes.post("/maintenance/cleanup/flowbuilder", isAuth, checkPermission("settings.edit"), cleanFlowbuilderOrphans);

export default maintenanceRoutes;
