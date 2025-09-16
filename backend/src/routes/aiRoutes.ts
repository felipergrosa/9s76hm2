import express from "express";
import isAuth from "../middleware/isAuth";
import * as AiController from "../controllers/AiController";

const routes = express.Router();

routes.post("/ai/generate-campaign-messages", isAuth, AiController.generateCampaignMessages);
routes.get("/ai/encryption-status", isAuth, AiController.encryptionStatus);
routes.post("/ai/transform", isAuth, AiController.transformText);
routes.get("/ai/models", isAuth, AiController.listModels);

export default routes;
