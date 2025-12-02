import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as AIAgentController from "../controllers/AIAgentController";

const aiAgentRoutes = Router();

// Listar todos os agentes
aiAgentRoutes.get("/ai-agents", isAuth, AIAgentController.index);

// Buscar um agente específico
aiAgentRoutes.get("/ai-agents/:id", isAuth, AIAgentController.show);

// Criar novo agente
aiAgentRoutes.post("/ai-agents", isAuth, AIAgentController.store);

// Atualizar agente
aiAgentRoutes.put("/ai-agents/:id", isAuth, AIAgentController.update);

// Deletar agente
aiAgentRoutes.delete("/ai-agents/:id", isAuth, AIAgentController.remove);

// Migration endpoint (admin only) - deve vir DEPOIS das rotas específicas
aiAgentRoutes.post("/ai-agents/migrate", isAuth, AIAgentController.migrate);

export default aiAgentRoutes;
