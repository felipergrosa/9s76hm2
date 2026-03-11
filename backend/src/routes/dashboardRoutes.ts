import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission, checkAnyPermission } from "../middleware/checkPermission";

import * as DashboardController from "../controllers/DashbardController";

const routes = express.Router();

routes.get("/dashboard", isAuth, checkPermission("dashboard.view"), DashboardController.index);
routes.get("/dashboard/ticketsUsers", isAuth, checkPermission("dashboard.view"), DashboardController.reportsUsers);
routes.get("/dashboard/ticketsDay", isAuth, checkPermission("dashboard.view"), DashboardController.reportsDay);
routes.get("/dashboard/moments", isAuth, checkAnyPermission(["dashboard.view", "realtime.view"]), DashboardController.DashTicketsQueues);

export default routes;
