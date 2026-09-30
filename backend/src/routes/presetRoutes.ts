import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as PresetController from "../controllers/PresetController";

const presetRoutes = express.Router();

presetRoutes.post("/preset", isAuth, checkPermission("settings.edit"), PresetController.store);
presetRoutes.get("/preset", isAuth, checkPermission("settings.view"), PresetController.index);
presetRoutes.delete("/preset/:presetId", isAuth, checkPermission("settings.edit"), PresetController.remove);
presetRoutes.get("/preset/test", isAuth, checkPermission("settings.view"), PresetController.test);

export default presetRoutes;
