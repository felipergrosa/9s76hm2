import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as MetaAutomationController from "../controllers/MetaAutomationController";

const routes = express.Router();

routes.get("/meta-automations", isAuth, checkPermission("meta-automations.view"), MetaAutomationController.index);
routes.get("/meta-automations/:id", isAuth, checkPermission("meta-automations.view"), MetaAutomationController.show);
routes.post("/meta-automations", isAuth, checkPermission("meta-automations.create"), MetaAutomationController.store);
routes.put("/meta-automations/:id", isAuth, checkPermission("meta-automations.edit"), MetaAutomationController.update);
routes.delete("/meta-automations/:id", isAuth, checkPermission("meta-automations.delete"), MetaAutomationController.remove);

export default routes;
