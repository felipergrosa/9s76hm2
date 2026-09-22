import { Router } from "express";
import isAuth from "../middleware/isAuth";
import checkPermission from "../middleware/checkPermission";
import * as InstagramSessionController from "../controllers/InstagramSessionController";

const instagramSessionRoutes = Router();

// Conectar/desconectar a conta IG da empresa exige permissão de importação de
// contatos (mesma permissão que protege o Lead Scraper que consome a sessão).
instagramSessionRoutes.get("/instagram-session/status", isAuth, InstagramSessionController.status);
instagramSessionRoutes.post("/instagram-session/connect", isAuth, checkPermission("contacts.import"), InstagramSessionController.connect);
instagramSessionRoutes.post("/instagram-session/2fa", isAuth, checkPermission("contacts.import"), InstagramSessionController.verify2fa);
instagramSessionRoutes.delete("/instagram-session", isAuth, checkPermission("contacts.import"), InstagramSessionController.disconnect);

export default instagramSessionRoutes;
