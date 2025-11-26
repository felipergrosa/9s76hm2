import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as QueueRAGSourceController from "../controllers/QueueRAGSourceController";

const queueRAGSourceRoutes = Router();

queueRAGSourceRoutes.get("/queues/:queueId/rag-sources", isAuth, QueueRAGSourceController.index);
queueRAGSourceRoutes.post("/queues/:queueId/rag-sources", isAuth, QueueRAGSourceController.store);
queueRAGSourceRoutes.delete("/queues/:queueId/rag-sources/:folderId", isAuth, QueueRAGSourceController.remove);

export default queueRAGSourceRoutes;
