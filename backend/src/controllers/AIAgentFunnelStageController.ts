import { Request, Response } from "express";
import AppError from "../errors/AppError";
import AIAgent from "../models/AIAgent";
import FunnelStage from "../models/FunnelStage";

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
