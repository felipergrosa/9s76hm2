import { Request, Response } from "express";
import AppError from "../errors/AppError";
import AIAgent from "../models/AIAgent";
import FunnelStage from "../models/FunnelStage";
import AITrainingFeedback from "../models/AITrainingFeedback";

export const createFeedback = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;

  const {
    agentId,
    stageId,
    sandboxSessionId,
    messageIndex,
    customerText,
    assistantText,
    rating,
    correctedText,
    explanation
  } = req.body || {};

  if (!agentId || !stageId || !sandboxSessionId) {
    throw new AppError("agentId, stageId e sandboxSessionId são obrigatórios", 400);
  }

  if (typeof messageIndex !== "number") {
    throw new AppError("messageIndex é obrigatório (number)", 400);
  }

  if (rating !== "correct" && rating !== "wrong") {
    throw new AppError("rating inválido (use 'correct' ou 'wrong')", 400);
  }

  if (rating === "wrong") {
    if (!correctedText || typeof correctedText !== "string" || !String(correctedText).trim()) {
      throw new AppError("correctedText é obrigatório quando rating='wrong'", 400);
    }
    if (!explanation || typeof explanation !== "string" || !String(explanation).trim()) {
      throw new AppError("explanation é obrigatório quando rating='wrong'", 400);
    }
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

  const feedback = await AITrainingFeedback.create({
    companyId,
    userId: Number(userId),
    agentId: agent.id,
    stageId: stage.id,
    sandboxSessionId: String(sandboxSessionId),
    messageIndex: Number(messageIndex),
    customerText: customerText ? String(customerText) : null,
    assistantText: assistantText ? String(assistantText) : null,
    rating,
    correctedText: correctedText ? String(correctedText) : null,
    explanation: explanation ? String(explanation) : null
  });

  return res.status(201).json({ feedback });
};

export const getStats = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const agentId = Number(req.query.agentId);
  const stageId = Number(req.query.stageId);

  if (!agentId || !stageId) {
    throw new AppError("agentId e stageId são obrigatórios", 400);
  }

  const correct = await AITrainingFeedback.count({
    where: { companyId, agentId, stageId, rating: "correct" }
  });

  const wrong = await AITrainingFeedback.count({
    where: { companyId, agentId, stageId, rating: "wrong" }
  });

  const total = correct + wrong;
  const accuracy = total > 0 ? correct / total : 0;

  return res.status(200).json({
    agentId,
    stageId,
    total,
    correct,
    wrong,
    accuracy
  });
};
