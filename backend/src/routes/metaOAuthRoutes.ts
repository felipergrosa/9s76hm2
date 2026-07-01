import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { startOAuth, oauthCallback } from "../controllers/MetaOAuthController";

const routes = Router();

routes.get("/meta-oauth/start", isAuth, startOAuth);
// callback is public — Meta redirects here after OAuth
routes.get("/meta-oauth/callback", oauthCallback);

export default routes;
