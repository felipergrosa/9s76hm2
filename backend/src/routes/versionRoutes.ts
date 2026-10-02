import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as VerssionController from "../controllers/VersionController";

const versionRouter = Router();

// GET público: o frontend consulta a versão antes do login (tela de login).
versionRouter.get("/version", VerssionController.index);
// POST grava a versão do frontend — mutação de configuração → settings.edit
versionRouter.post("/version", isAuth, checkPermission("settings.edit"), VerssionController.store);

export default versionRouter;
