import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as ChatController from "../controllers/ChatController";

const routes = express.Router();

routes.get("/chats", isAuth, checkPermission("internal-chat.view"), ChatController.index);
routes.get("/chats/:id", isAuth, checkPermission("internal-chat.view"), ChatController.show);
routes.get("/chats/:id/messages", isAuth, checkPermission("internal-chat.view"), ChatController.messages);
routes.post("/chats/:id/messages", isAuth, checkPermission("internal-chat.view"), ChatController.saveMessage);
routes.post("/chats/:id/read", isAuth, checkPermission("internal-chat.view"), ChatController.checkAsRead);
routes.post("/chats", isAuth, checkPermission("internal-chat.view"), ChatController.store);
routes.put("/chats/:id", isAuth, checkPermission("internal-chat.view"), ChatController.update);
routes.delete("/chats/:id", isAuth, checkPermission("internal-chat.view"), ChatController.remove);

export default routes;
