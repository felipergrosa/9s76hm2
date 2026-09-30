import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkAdminOrSuper } from "../middleware/checkPermission";

import * as VerssionController from "../controllers/VersionController";

const versionRouter = Router();

versionRouter.get("/version", VerssionController.index);
versionRouter.post("/version", isAuth, checkAdminOrSuper(), VerssionController.store);

export default versionRouter;
