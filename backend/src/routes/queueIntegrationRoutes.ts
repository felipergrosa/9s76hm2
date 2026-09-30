import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as QueueIntegrationController from "../controllers/QueueIntegrationController";

const queueIntegrationRoutes = Router();

// O catálogo (PermissionAdapter) não tem integrations.create/edit/delete —
// escritas exigem settings.edit; leituras seguem com integrations.view.
queueIntegrationRoutes.get("/queueIntegration", isAuth, checkPermission("integrations.view"), QueueIntegrationController.index);

queueIntegrationRoutes.post("/queueIntegration", isAuth, checkPermission("settings.edit"), QueueIntegrationController.store);

queueIntegrationRoutes.get("/queueIntegration/:integrationId", isAuth, checkPermission("integrations.view"), QueueIntegrationController.show);

queueIntegrationRoutes.put("/queueIntegration/:integrationId", isAuth, checkPermission("settings.edit"), QueueIntegrationController.update);

queueIntegrationRoutes.delete("/queueIntegration/:integrationId", isAuth, checkPermission("settings.edit"), QueueIntegrationController.remove);

queueIntegrationRoutes.post("/queueIntegration/testsession", isAuth, checkPermission("settings.edit"), QueueIntegrationController.testSession);

export default queueIntegrationRoutes;
