import { Request, Response } from "express";
import AppError from "../errors/AppError";
import AIAgent from "../models/AIAgent";
import FunnelStage from "../models/FunnelStage";
import { BOT_AVAILABLE_FUNCTIONS } from "../services/IA/BotFunctions";
import { DEFAULT_SKILLS } from "../services/IA/AISkill";
import { SKILL_CATALOG, SKILL_CATEGORY_LABELS } from "../services/IA/SkillCatalog";

/**
 * Mapa de capacidades do software para IA: funções executáveis pelo bot,
 * skills padrão e, opcionalmente, o que uma etapa de funil específica tem
 * habilitado.
 */
export const getCapabilities = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { agentId, stageId } = req.query;

  const functions = BOT_AVAILABLE_FUNCTIONS.map(fn => ({
    name: fn.name,
    description: fn.description,
    parameters: fn.parameters
  }));

  const defaultSkills = DEFAULT_SKILLS.map(skill => ({
    name: skill.name,
    category: skill.category,
    description: skill.description,
    functions: skill.functions
  }));

  // Catálogo completo de skills ativáveis — o frontend usa para
  // agrupar por categoria e ativar sob demanda por agente.
  const skillCatalog = SKILL_CATALOG.map(s => ({
    key: s.key,
    name: s.name,
    category: s.category,
    categoryLabel: SKILL_CATEGORY_LABELS[s.category] || s.category,
    description: s.description,
    functions: s.functions,
    priority: s.priority
  }));

  const response: any = { functions, defaultSkills, skillCatalog, skillCategories: SKILL_CATEGORY_LABELS };

  if (agentId || stageId) {
    if (!agentId || !stageId) {
      throw new AppError("agentId e stageId devem ser informados juntos", 400);
    }

    const agent = await AIAgent.findOne({
      where: { id: Number(agentId), companyId }
    });
    if (!agent) throw new AppError("ERR_AGENT_NOT_FOUND", 404);

    const stage = await FunnelStage.findOne({
      where: { id: Number(stageId), agentId: agent.id }
    });
    if (!stage) throw new AppError("ERR_FUNNEL_STAGE_NOT_FOUND", 404);

    const catalogNames = new Set(functions.map(fn => fn.name));
    const enabled = Array.isArray(stage.enabledFunctions) ? stage.enabledFunctions : [];

    // Convenção atual do produto: enabledFunctions vazio/ausente significa
    // "todas as funções disponíveis" — explicitado via allAvailable para a
    // UI não confundir com "nenhuma habilitada".
    const allAvailable = enabled.length === 0;
    const availableFunctions = allAvailable
      ? [...catalogNames]
      : enabled.filter(name => catalogNames.has(name));
    const unavailableFunctions = allAvailable
      ? []
      : [...catalogNames].filter(name => !enabled.includes(name));

    response.stage = {
      id: stage.id,
      enabledFunctions: enabled,
      availableFunctions,
      unavailableFunctions,
      allAvailable
    };
  }

  return res.status(200).json(response);
};
