import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as AiController from "../controllers/AiController";
import * as AIOrchestatorController from "../controllers/AIOrchestatorController";
import * as AISandboxController from "../controllers/AISandboxController";
import * as AITrainingFeedbackController from "../controllers/AITrainingFeedbackController";
import * as AITrainingImprovementController from "../controllers/AITrainingImprovementController";

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

// Training feedback / scoring
routes.post(
  "/ai/training/feedback",
  isAuth,
  checkPermission("ai-training.view"),
  AITrainingFeedbackController.createFeedback
);

routes.get(
  "/ai/training/stats",
  isAuth,
  checkPermission("ai-training.view"),
  AITrainingFeedbackController.getStats
);

routes.post(
  "/ai/training/improvements",
  isAuth,
  checkPermission("ai-training.view"),
  AITrainingImprovementController.createImprovement
);

routes.post(
  "/ai/training/improvements/apply",
  isAuth,
  checkPermission("ai-training.view"),
  AITrainingImprovementController.applyImprovements
);

export default routes;
