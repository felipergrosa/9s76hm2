import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as HelpController from "../controllers/HelpController";

const routes = express.Router();

routes.get("/helps/list", isAuth, checkPermission("helps.view"), HelpController.findList);

routes.get("/helps", isAuth, checkPermission("helps.view"), HelpController.index);

routes.get("/helps/:id", isAuth, checkPermission("helps.view"), HelpController.show);

routes.post("/helps", isAuth, checkPermission("settings.edit"), HelpController.store);

routes.put("/helps/:id", isAuth, checkPermission("settings.edit"), HelpController.update);

routes.delete("/helps/:id", isAuth, checkPermission("settings.edit"), HelpController.remove);

export default routes;
