import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { debugImportHistory, debugChatModify } from "../controllers/DebugController";
import { debugContactSearch } from "../controllers/DebugContactController";

const debugRoutes = Router();

debugRoutes.get("/debug/import-history/:ticketId", isAuth, debugImportHistory);
debugRoutes.post("/debug/chat-modify/:ticketId", isAuth, debugChatModify);
debugRoutes.get("/debug/contact-search", isAuth, debugContactSearch);

export default debugRoutes;
