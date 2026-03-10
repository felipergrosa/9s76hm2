import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkAdminOrSuper } from "../middleware/checkPermission";
import { debugImportHistory, debugChatModify } from "../controllers/DebugController";
import { debugContactSearch } from "../controllers/DebugContactController";

const debugRoutes = Router();

debugRoutes.get("/debug/import-history/:ticketId", isAuth, checkAdminOrSuper(), debugImportHistory);
debugRoutes.post("/debug/chat-modify/:ticketId", isAuth, checkAdminOrSuper(), debugChatModify);
debugRoutes.get("/debug/contact-search", isAuth, checkAdminOrSuper(), debugContactSearch);

export default debugRoutes;
