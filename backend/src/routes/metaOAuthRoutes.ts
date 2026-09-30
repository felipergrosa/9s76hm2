import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import { startOAuth, oauthCallback } from "../controllers/MetaOAuthController";

const routes = Router();

routes.get("/meta-oauth/start", isAuth, checkPermission("connections.create"), startOAuth);
// callback is public — Meta redirects here after OAuth
routes.get("/meta-oauth/callback", oauthCallback);

export default routes;
