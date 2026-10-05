import { Request, Response } from "express";
import AppError from "../errors/AppError";
import AIAgent from "../models/AIAgent";
import FunnelStage from "../models/FunnelStage";
import AITrainingFeedback from "../models/AITrainingFeedback";
import AITrainingImprovement from "../models/AITrainingImprovement";
import buildImprovementText from "../utils/buildImprovementText";
import { categorizeImprovement } from "../services/AIAgentServices/TrainingPatternAnalyzer";

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

  // Loop de treinamento: feedback negativo com correção vira improvement
  // pendente automaticamente — depois aplicada como Skill em applyImprovements.
  if (rating === "wrong" && (correctedText || explanation)) {
    const improvementText = buildImprovementText({
      customerText: feedback.customerText,
      correctedText: feedback.correctedText,
      explanation: feedback.explanation
    });

    if (improvementText) {
      const improvement = await AITrainingImprovement.create({
        companyId,
        userId: Number(userId),
        agentId: agent.id,
        stageId: stage.id,
        feedbackId: feedback.id,
        improvementText,
        category: null,
        severity: null,
        intentDetected: null,
        verifiedInProduction: false,
        status: "pending",
        appliedAt: null,
        consolidatedPrompt: null
      });

      // Categorização assíncrona, igual ao fluxo manual de createImprovement
      categorizeImprovement(companyId, improvementText, feedback.customerText, feedback.assistantText)
        .then(async categorization => {
          await improvement.update({
            category: categorization.category,
            severity: categorization.severity,
            intentDetected: categorization.intentDetected
          });
        })
        .catch(err => console.error("Erro ao categorizar melhoria automática:", err));
    }
  }

  return res.status(201).json({ feedback });
};

export const listFeedbacks = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const agentId = Number(req.query.agentId);
  if (!agentId) {
    throw new AppError("agentId é obrigatório", 400);
  }

  const where: any = { companyId, agentId };
  if (req.query.stageId) where.stageId = Number(req.query.stageId);
  if (req.query.rating) {
    const rating = String(req.query.rating);
    if (rating !== "correct" && rating !== "wrong") {
      throw new AppError("rating inválido (use 'correct' ou 'wrong')", 400);
    }
    where.rating = rating;
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const { rows: feedbacks, count: total } = await AITrainingFeedback.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
    offset
  });

  return res.status(200).json({
    feedbacks,
    total,
    page,
    pages: Math.ceil(total / limit)
  });
};

export const getStats = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const agentId = Number(req.query.agentId);
  const stageId = req.query.stageId ? Number(req.query.stageId) : undefined;

  if (!agentId) {
    throw new AppError("agentId é obrigatório", 400);
  }

  // stageId opcional: sem ele as estatísticas cobrem o agente inteiro
  const baseWhere: any = { companyId, agentId };
  if (stageId) baseWhere.stageId = stageId;

  const correct = await AITrainingFeedback.count({
    where: { ...baseWhere, rating: "correct" }
  });

  const wrong = await AITrainingFeedback.count({
    where: { ...baseWhere, rating: "wrong" }
  });

  const total = correct + wrong;
  const accuracy = total > 0 ? correct / total : 0;

  return res.status(200).json({
    agentId,
    stageId: stageId || null,
    total,
    correct,
    wrong,
    accuracy
  });
};
