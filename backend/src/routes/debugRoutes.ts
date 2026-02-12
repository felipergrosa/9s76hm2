import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { debugImportHistory, debugChatModify } from "../controllers/DebugController";

const debugRoutes = Router();

debugRoutes.get("/debug/import-history/:ticketId", isAuth, debugImportHistory);
debugRoutes.post("/debug/chat-modify/:ticketId", isAuth, debugChatModify);

export default debugRoutes;
