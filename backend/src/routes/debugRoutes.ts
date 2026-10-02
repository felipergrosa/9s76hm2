import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import { debugImportHistory, debugChatModify } from "../controllers/DebugController";
import { debugContactSearch } from "../controllers/DebugContactController";

const debugRoutes = Router();

// Endpoints de diagnóstico/manutenção → settings.edit (era checkAdminOrSuper)
debugRoutes.get("/debug/import-history/:ticketId", isAuth, checkPermission("settings.edit"), debugImportHistory);
debugRoutes.post("/debug/chat-modify/:ticketId", isAuth, checkPermission("settings.edit"), debugChatModify);
debugRoutes.get("/debug/contact-search", isAuth, checkPermission("settings.edit"), debugContactSearch);

export default debugRoutes;
