import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as AiController from "../controllers/AiController";
import * as AIOrchestatorController from "../controllers/AIOrchestatorController";
import * as AISandboxController from "../controllers/AISandboxController";
import * as AITrainingFeedbackController from "../controllers/AITrainingFeedbackController";
import * as AITrainingImprovementController from "../controllers/AITrainingImprovementController";
import * as AIPromptAssistantController from "../controllers/AIPromptAssistantController";
import * as AITestScenariosController from "../controllers/AITestScenariosController";
import * as AIPromptVersionController from "../controllers/AIPromptVersionController";
import * as AITrainingMetricsController from "../controllers/AITrainingMetricsController";

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

// ========== MÉTRICAS DO TREINAMENTO ==========
routes.get(
  "/ai/training/metrics",
  isAuth,
  checkPermission("ai-training.view"),
  AITrainingMetricsController.getTrainingMetrics
);

// ========== NOVAS ROTAS - ASSISTENTE DE PROMPT ==========
routes.post(
  "/ai/prompt-assistant/rewrite",
  isAuth,
  checkPermission("ai-training.view"),
  AIPromptAssistantController.rewritePrompt
);

routes.post(
  "/ai/prompt-assistant/suggest",
  isAuth,
  checkPermission("ai-training.view"),
  AIPromptAssistantController.suggestImprovements
);

routes.get(
  "/ai/prompt-assistant/variables",
  isAuth,
  checkPermission("ai-training.view"),
  AIPromptAssistantController.getPromptVariables
);

// ========== NOVAS ROTAS - TESTES UNITÁRIOS ==========
routes.post(
  "/ai/test-scenarios",
  isAuth,
  checkPermission("ai-training.view"),
  AITestScenariosController.createScenario
);

routes.get(
  "/ai/test-scenarios",
  isAuth,
  checkPermission("ai-training.view"),
  AITestScenariosController.listScenarios
);

routes.post(
  "/ai/test-scenarios/:scenarioId/run",
  isAuth,
  checkPermission("ai-training.view"),
  AITestScenariosController.runScenario
);

routes.delete(
  "/ai/test-scenarios/:scenarioId",
  isAuth,
  checkPermission("ai-training.view"),
  AITestScenariosController.deleteScenario
);

routes.get(
  "/ai/test-results",
  isAuth,
  checkPermission("ai-training.view"),
  AITestScenariosController.getTestHistory
);

// ========== NOVAS ROTAS - VERSIONAMENTO DE PROMPT ==========
routes.post(
  "/ai/prompt-versions",
  isAuth,
  checkPermission("ai-training.view"),
  AIPromptVersionController.createVersion
);

routes.get(
  "/ai/prompt-versions",
  isAuth,
  checkPermission("ai-training.view"),
  AIPromptVersionController.listVersions
);

routes.get(
  "/ai/prompt-versions/:versionId",
  isAuth,
  checkPermission("ai-training.view"),
  AIPromptVersionController.getVersion
);

routes.post(
  "/ai/prompt-versions/:versionId/rollback",
  isAuth,
  checkPermission("ai-training.view"),
  AIPromptVersionController.rollbackToVersion
);

routes.get(
  "/ai/prompt-versions/compare",
  isAuth,
  checkPermission("ai-training.view"),
  AIPromptVersionController.compareVersions
);

export default routes;

routes.post(
  "/ai/prompt-versions/:versionId/rollback",
  isAuth,
  checkPermission("ai-training.view"),
  AIPromptVersionController.rollbackToVersion
);
routes.get(
  "/ai/prompt-versions/compare",
  isAuth,
  checkPermission("ai-training.view"),
  AIPromptVersionController.compareVersions
);

export default routes;

