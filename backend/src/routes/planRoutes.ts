import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import checkSuper from "../middleware/checkSuper";

import * as PlanController from "../controllers/PlanController";

const planRoutes = express.Router();

planRoutes.get("/plans", isAuth, checkPermission("settings.view"), PlanController.index);
planRoutes.get("/plans/list", isAuth, checkPermission("settings.view"), PlanController.list);
planRoutes.get("/plans/all", isAuth, checkPermission("settings.view"), PlanController.list);
planRoutes.get("/plans/:id", isAuth, checkPermission("settings.view"), PlanController.show);
// SEGURANÇA: escrita em planos exige super admin real (verificado no DB)
planRoutes.post("/plans", isAuth, checkSuper, PlanController.store);
planRoutes.put("/plans/:id", isAuth, checkSuper, PlanController.update);
planRoutes.delete("/plans/:id", isAuth, checkSuper, PlanController.remove);

export default planRoutes;
