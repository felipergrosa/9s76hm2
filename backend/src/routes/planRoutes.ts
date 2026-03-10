import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission, checkAdminOrSuper } from "../middleware/checkPermission";

import * as PlanController from "../controllers/PlanController";

const planRoutes = express.Router();

planRoutes.get("/plans", isAuth, checkPermission("settings.view"), PlanController.index);
planRoutes.get("/plans/list", isAuth, checkPermission("settings.view"), PlanController.list);
planRoutes.get("/plans/all", isAuth, checkPermission("settings.view"), PlanController.list);
planRoutes.get("/plans/:id", isAuth, checkPermission("settings.view"), PlanController.show);
planRoutes.post("/plans", isAuth, checkAdminOrSuper(), PlanController.store);
planRoutes.put("/plans/:id", isAuth, checkAdminOrSuper(), PlanController.update);
planRoutes.delete("/plans/:id", isAuth, checkAdminOrSuper(), PlanController.remove);

export default planRoutes;
