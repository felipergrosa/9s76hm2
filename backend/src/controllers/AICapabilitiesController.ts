import { Request, Response } from "express";
import AppError from "../errors/AppError";
import AIAgent from "../models/AIAgent";
import FunnelStage from "../models/FunnelStage";
import { BOT_AVAILABLE_FUNCTIONS } from "../services/IA/BotFunctions";
import { DEFAULT_SKILLS } from "../services/IA/AISkill";

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

  const response: any = { functions, defaultSkills };

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
