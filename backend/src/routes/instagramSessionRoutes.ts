import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as InstagramSessionController from "../controllers/InstagramSessionController";

const instagramSessionRoutes = Router();

instagramSessionRoutes.get("/instagram-session/status", isAuth, InstagramSessionController.status);
instagramSessionRoutes.post("/instagram-session/connect", isAuth, InstagramSessionController.connect);
instagramSessionRoutes.post("/instagram-session/2fa", isAuth, InstagramSessionController.verify2fa);
instagramSessionRoutes.delete("/instagram-session", isAuth, InstagramSessionController.disconnect);

export default instagramSessionRoutes;
