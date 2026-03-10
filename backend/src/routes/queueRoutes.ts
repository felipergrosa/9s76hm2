import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as QueueController from "../controllers/QueueController";

const queueRoutes = Router();

queueRoutes.get("/queue", isAuth, checkPermission("queues.view"), QueueController.index);

queueRoutes.post("/queue", isAuth, checkPermission("queues.create"), QueueController.store);

queueRoutes.get("/queue/:queueId", isAuth, checkPermission("queues.view"), QueueController.show);

queueRoutes.put("/queue/:queueId", isAuth, checkPermission("queues.edit"), QueueController.update);

queueRoutes.delete("/queue/:queueId", isAuth, checkPermission("queues.delete"), QueueController.remove);

export default queueRoutes;
