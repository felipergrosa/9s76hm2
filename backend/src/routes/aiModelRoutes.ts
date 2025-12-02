import express from "express";
import * as AIModelController from "../controllers/AIModelController";
import isAuth from "../middleware/isAuth";

const aiModelRoutes = express.Router();

aiModelRoutes.get("/ai-models", isAuth, AIModelController.listModels);

export default aiModelRoutes;
