import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as ChatbotController from "../controllers/ChatbotController";

const chatBotRoutes = Router();

chatBotRoutes.get("/chatbot", isAuth, checkPermission("queues.view"), ChatbotController.index);

chatBotRoutes.post("/chatbot", isAuth, checkPermission("queues.edit"), ChatbotController.store);

chatBotRoutes.get("/chatbot/:chatbotId", isAuth, checkPermission("queues.view"), ChatbotController.show);

chatBotRoutes.put("/chatbot/:chatbotId", isAuth, checkPermission("queues.edit"), ChatbotController.update);

chatBotRoutes.delete("/chatbot/:chatbotId", isAuth, checkPermission("queues.edit"), ChatbotController.remove);

export default chatBotRoutes;
