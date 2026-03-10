import express from "express";
import * as AIModelController from "../controllers/AIModelController";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

const aiModelRoutes = express.Router();

aiModelRoutes.get("/ai-models", isAuth, checkPermission("ai-settings.view"), AIModelController.listModels);

export default aiModelRoutes;
