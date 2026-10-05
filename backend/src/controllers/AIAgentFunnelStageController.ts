import { Request, Response } from "express";
import AppError from "../errors/AppError";
import AIAgent from "../models/AIAgent";
import FunnelStage from "../models/FunnelStage";
import { BOT_AVAILABLE_FUNCTIONS } from "../services/IA/BotFunctions";

export const listStages = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  const agent = await AIAgent.findOne({
    where: { id: Number(id), companyId }
  });

  if (!agent) {
    throw new AppError("ERR_AGENT_NOT_FOUND", 404);
  }

  const stages = await FunnelStage.findAll({
    where: { agentId: agent.id },
    order: [["order", "ASC"]]
  });

  return res.status(200).json({ stages });
};

export const updateStageSystemPrompt = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { agentId, stageId } = req.params;
  const { systemPrompt } = req.body;

  if (!systemPrompt || typeof systemPrompt !== "string") {
    throw new AppError("Campo 'systemPrompt' é obrigatório", 400);
  }

  const agent = await AIAgent.findOne({
    where: { id: Number(agentId), companyId }
  });

  if (!agent) {
    throw new AppError("ERR_AGENT_NOT_FOUND", 404);
  }

  const stage = await FunnelStage.findOne({
    where: { id: Number(stageId), agentId: agent.id }
  });

  if (!stage) {
    throw new AppError("ERR_FUNNEL_STAGE_NOT_FOUND", 404);
  }

  await stage.update({
    systemPrompt: systemPrompt.trim()
  });

  return res.status(200).json(stage);
};

// Atualiza as funções habilitadas de uma etapa (enabledFunctions).
// Convenção do produto: array VAZIO = todas as funções disponíveis.
export const updateStageEnabledFunctions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { agentId, stageId } = req.params;
  const { enabledFunctions } = req.body;

  if (!Array.isArray(enabledFunctions)) {
    throw new AppError("Campo 'enabledFunctions' deve ser um array", 400);
  }

  const catalogNames = new Set(BOT_AVAILABLE_FUNCTIONS.map(f => f.name));
  const invalid = enabledFunctions.filter(n => !catalogNames.has(String(n)));
  if (invalid.length > 0) {
    throw new AppError(`Funções desconhecidas: ${invalid.join(", ")}`, 400);
  }

  const agent = await AIAgent.findOne({
    where: { id: Number(agentId), companyId }
  });
  if (!agent) throw new AppError("ERR_AGENT_NOT_FOUND", 404);

  const stage = await FunnelStage.findOne({
    where: { id: Number(stageId), agentId: agent.id }
  });
  if (!stage) throw new AppError("ERR_FUNNEL_STAGE_NOT_FOUND", 404);

  await stage.update({ enabledFunctions: enabledFunctions.map(String) });

  return res.status(200).json({
    id: stage.id,
    enabledFunctions: stage.enabledFunctions,
    allAvailable: stage.enabledFunctions.length === 0
  });
};
