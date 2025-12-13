import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as AIAgentController from "../controllers/AIAgentController";
import * as AIAgentFunnelStageController from "../controllers/AIAgentFunnelStageController";

const aiAgentRoutes = Router();

// Listar todos os agentes
aiAgentRoutes.get("/ai-agents", isAuth, AIAgentController.index);

// Buscar um agente específico
aiAgentRoutes.get("/ai-agents/:id", isAuth, AIAgentController.show);

// Listar etapas do funil de um agente
aiAgentRoutes.get(
  "/ai-agents/:id/funnel-stages",
  isAuth,
  checkPermission("ai-training.view"),
  AIAgentFunnelStageController.listStages
);

// Atualizar prompt do sistema de uma etapa do funil
aiAgentRoutes.put(
  "/ai-agents/:agentId/funnel-stages/:stageId/system-prompt",
  isAuth,
  checkPermission("ai-training.view"),
  AIAgentFunnelStageController.updateStageSystemPrompt
);

// Criar novo agente
aiAgentRoutes.post("/ai-agents", isAuth, AIAgentController.store);

// Atualizar agente
aiAgentRoutes.put("/ai-agents/:id", isAuth, AIAgentController.update);

// Deletar agente
aiAgentRoutes.delete("/ai-agents/:id", isAuth, AIAgentController.remove);

// Migration endpoint (admin only) - deve vir DEPOIS das rotas específicas
aiAgentRoutes.post("/ai-agents/migrate", isAuth, AIAgentController.migrate);

export default aiAgentRoutes;
