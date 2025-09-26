import express from "express";
import isAuth from "../middleware/isAuth";
import * as PresetController from "../controllers/PresetController";

const presetRoutes = express.Router();

// Middleware de log para debug
presetRoutes.use((req, res, next) => {
  console.log(`[PresetRoutes] ${req.method} ${req.path} - Body:`, req.body);
  next();
});

presetRoutes.post("/preset", isAuth, PresetController.store);
presetRoutes.get("/preset", isAuth, PresetController.index);
presetRoutes.delete("/preset/:presetId", isAuth, PresetController.remove);
presetRoutes.get("/preset/test", isAuth, PresetController.test);

export default presetRoutes;
