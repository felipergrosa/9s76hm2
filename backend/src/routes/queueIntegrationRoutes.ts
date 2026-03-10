import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as QueueIntegrationController from "../controllers/QueueIntegrationController";

const queueIntegrationRoutes = Router();

queueIntegrationRoutes.get("/queueIntegration", isAuth, checkPermission("integrations.view"), QueueIntegrationController.index);

queueIntegrationRoutes.post("/queueIntegration", isAuth, checkPermission("integrations.view"), QueueIntegrationController.store);

queueIntegrationRoutes.get("/queueIntegration/:integrationId", isAuth, checkPermission("integrations.view"), QueueIntegrationController.show);

queueIntegrationRoutes.put("/queueIntegration/:integrationId", isAuth, checkPermission("integrations.view"), QueueIntegrationController.update);

queueIntegrationRoutes.delete("/queueIntegration/:integrationId", isAuth, checkPermission("integrations.view"), QueueIntegrationController.remove);

queueIntegrationRoutes.post("/queueIntegration/testsession", isAuth, checkPermission("integrations.view"), QueueIntegrationController.testSession);

export default queueIntegrationRoutes;