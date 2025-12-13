import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as AiController from "../controllers/AiController";
import * as AIOrchestatorController from "../controllers/AIOrchestatorController";
import * as AISandboxController from "../controllers/AISandboxController";

const routes = express.Router();

// Rotas existentes (mantidas para compatibilidade)
routes.post("/ai/generate-campaign-messages", isAuth, AiController.generateCampaignMessages);
routes.get("/ai/encryption-status", isAuth, AiController.encryptionStatus);
routes.post("/ai/transform", isAuth, AiController.transformText);
routes.get("/ai/models", isAuth, AiController.listModels);

// Rotas para gerenciamento de presets
routes.post("/ai/presets", isAuth, AiController.savePreset);
routes.get("/ai/presets", isAuth, AiController.listPresets);
routes.delete("/ai/presets/:module", isAuth, AiController.deletePreset);

// Novas rotas do AIOrchestrator
routes.post("/ai/orchestrator/process", isAuth, AIOrchestatorController.processAIRequest);
routes.post("/ai/orchestrator/transform", isAuth, AIOrchestatorController.transformText);
routes.post("/ai/orchestrator/test-providers", isAuth, AIOrchestatorController.testProviders);
routes.get("/ai/orchestrator/stats", isAuth, AIOrchestatorController.getStats);

// Training / Sandbox
routes.post(
  "/ai/sandbox/sessions",
  isAuth,
  checkPermission("ai-training.view"),
  AISandboxController.createSession
);

routes.post(
  "/ai/sandbox/sessions/:sessionId/messages",
  isAuth,
  checkPermission("ai-training.view"),
  AISandboxController.sendMessage
);

export default routes;
