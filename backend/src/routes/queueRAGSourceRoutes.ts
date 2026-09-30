import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as QueueRAGSourceController from "../controllers/QueueRAGSourceController";

const queueRAGSourceRoutes = Router();

queueRAGSourceRoutes.get("/queues/:queueId/rag-sources", isAuth, checkPermission("files.view"), QueueRAGSourceController.index);
queueRAGSourceRoutes.post("/queues/:queueId/rag-sources", isAuth, checkPermission("files.upload"), QueueRAGSourceController.store);
queueRAGSourceRoutes.delete("/queues/:queueId/rag-sources/:folderId", isAuth, checkPermission("files.upload"), QueueRAGSourceController.remove);

export default queueRAGSourceRoutes;
