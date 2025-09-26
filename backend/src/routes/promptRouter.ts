import { Router } from "express";
import * as PromptController from "../controllers/PromptController";
import isAuth from "../middleware/isAuth";


const promptRoutes = Router();

promptRoutes.get("/prompt", isAuth, PromptController.index);

promptRoutes.post("/prompt", isAuth, PromptController.store);

promptRoutes.get("/prompt/:promptId", isAuth, PromptController.show);

promptRoutes.put("/prompt/:promptId", isAuth, PromptController.update);

promptRoutes.delete("/prompt/:promptId", isAuth, PromptController.remove);

promptRoutes.get("/prompts/stats", isAuth, PromptController.stats);

export default promptRoutes;
