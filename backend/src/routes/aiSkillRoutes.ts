/**
 * Rotas para gerenciamento de skills de AI Agents
 */

import { Router } from "express";
import * as AIAgentSkillController from "../controllers/AIAgentSkillController";
import isAuth from "../middleware/isAuth";

const skillRoutes = Router();

// ========== SKILLS PADRÃO (TEMPLATE) ==========

// Lista todas as skills padrão disponíveis
skillRoutes.get("/default", isAuth, AIAgentSkillController.listDefault);

// Valida uma skill antes de salvar
skillRoutes.post("/validate", isAuth, AIAgentSkillController.validate);

// ========== SKILLS POR AGENTE ==========

// Lista todas as skills de um agente (padrão + customizadas)
skillRoutes.get("/agents/:agentId/skills", isAuth, AIAgentSkillController.index);

// Cria uma nova skill customizada para um agente
skillRoutes.post("/agents/:agentId/skills", isAuth, AIAgentSkillController.store);

// Atualiza uma skill customizada
skillRoutes.put("/agents/:agentId/skills/:skillId", isAuth, AIAgentSkillController.update);

// Remove uma skill customizada
skillRoutes.delete("/agents/:agentId/skills/:skillId", isAuth, AIAgentSkillController.destroy);

// Ativa/desativa uma skill
skillRoutes.patch("/agents/:agentId/skills/:skillId/toggle", isAuth, AIAgentSkillController.toggle);

// Duplica uma skill padrão para customização
skillRoutes.post("/agents/:agentId/skills/fork/:skillName", isAuth, AIAgentSkillController.fork);

// Importa skills em massa
skillRoutes.post("/agents/:agentId/skills/import", isAuth, AIAgentSkillController.importSkills);

// Exporta skills de um agente
skillRoutes.get("/agents/:agentId/skills/export", isAuth, AIAgentSkillController.exportSkills);

export default skillRoutes;
