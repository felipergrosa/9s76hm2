import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import { startOAuth, oauthCallback, showMetaSelection, confirmMetaSelection } from "../controllers/MetaOAuthController";

const routes = Router();

routes.get("/meta-oauth/start", isAuth, checkPermission("connections.create"), startOAuth);
routes.post("/meta-oauth/start", isAuth, checkPermission("connections.create"), startOAuth);
// callback is public — Meta redirects here after OAuth
routes.get("/meta-oauth/callback", oauthCallback);
// seleção granular de páginas/contas pós-OAuth (autenticado)
routes.get("/meta-oauth/selection/:key", isAuth, checkPermission("connections.view"), showMetaSelection);
routes.post("/meta-oauth/selection/:key", isAuth, checkPermission("connections.create"), confirmMetaSelection);

export default routes;
