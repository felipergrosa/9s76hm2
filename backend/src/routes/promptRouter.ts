import { Router } from "express";
import * as PromptController from "../controllers/PromptController";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";


const promptRoutes = Router();

promptRoutes.get("/prompt", isAuth, checkPermission("prompts.view"), PromptController.index);

promptRoutes.post("/prompt", isAuth, checkPermission("prompts.create"), PromptController.store);

promptRoutes.get("/prompt/:promptId", isAuth, checkPermission("prompts.view"), PromptController.show);

promptRoutes.put("/prompt/:promptId", isAuth, checkPermission("prompts.edit"), PromptController.update);

promptRoutes.delete("/prompt/:promptId", isAuth, checkPermission("prompts.delete"), PromptController.remove);

promptRoutes.get("/prompts/stats", isAuth, checkPermission("prompts.view"), PromptController.stats);

export default promptRoutes;
