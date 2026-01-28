import express from "express";
import isAuth from "../middleware/isAuth";
import { checkAdminOrSuper } from "../middleware/checkPermission";
import { cleanFlowbuilderOrphans } from "../controllers/MaintenanceController";

const maintenanceRoutes = express.Router();

// Migrado de isSuper (legado) para checkAdminOrSuper - mais consistente
maintenanceRoutes.post("/maintenance/cleanup/flowbuilder", isAuth, checkAdminOrSuper(), cleanFlowbuilderOrphans);

export default maintenanceRoutes;
