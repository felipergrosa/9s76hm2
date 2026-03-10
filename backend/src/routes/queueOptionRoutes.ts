import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as QueueOptionController from "../controllers/QueueOptionController";

const queueOptionRoutes = Router();

queueOptionRoutes.get("/queue-options", isAuth, checkPermission("queues.view"), QueueOptionController.index);
queueOptionRoutes.post("/queue-options", isAuth, checkPermission("queues.create"), QueueOptionController.store);
queueOptionRoutes.get("/queue-options/:queueOptionId", isAuth, checkPermission("queues.view"), QueueOptionController.show);
queueOptionRoutes.put("/queue-options/:queueOptionId", isAuth, checkPermission("queues.edit"), QueueOptionController.update);
queueOptionRoutes.delete("/queue-options/:queueOptionId", isAuth, checkPermission("queues.delete"), QueueOptionController.remove);

export default queueOptionRoutes;
