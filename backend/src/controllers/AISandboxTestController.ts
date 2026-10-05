import { Request, Response } from "express";
import AppError from "../errors/AppError";
import AIAgent from "../models/AIAgent";
import FunnelStage from "../models/FunnelStage";
import AIOrchestrator from "../services/IA/AIOrchestrator";

/**
 * Teste avulso de prompt no sandbox: dispara uma mensagem única contra um
 * systemPrompt fornecido, sem criar sessão. O frontend consome `response`.
 */
export const test = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;

  const { systemPrompt, userMessage, agentId, stageId } = req.body || {};

  if (!systemPrompt || typeof systemPrompt !== "string" || !systemPrompt.trim()) {
    throw new AppError("systemPrompt é obrigatório", 400);
  }
  if (!userMessage || typeof userMessage !== "string" || !userMessage.trim()) {
    throw new AppError("userMessage é obrigatório", 400);
  }
  if (!agentId) {
    throw new AppError("agentId é obrigatório", 400);
  }

  const agent = await AIAgent.findOne({
    where: { id: Number(agentId), companyId }
  });
  if (!agent) throw new AppError("ERR_AGENT_NOT_FOUND", 404);

  if (stageId) {
    const stage = await FunnelStage.findOne({
      where: { id: Number(stageId), agentId: agent.id }
    });
    if (!stage) throw new AppError("ERR_FUNNEL_STAGE_NOT_FOUND", 404);
  }

  const ai = await AIOrchestrator.processRequest({
    module: "general",
    mode: "chat",
    companyId,
    userId: userId ? Number(userId) : undefined,
    text: String(userMessage).trim(),
    systemPrompt: String(systemPrompt),
    preferProvider: agent.aiProvider || undefined,
    model: agent.aiModel || undefined,
    temperature: agent.temperature ?? undefined,
    maxTokens: agent.maxTokens || undefined,
    metadata: {
      sandboxTest: true,
      agentId: agent.id,
      stageId: stageId ? Number(stageId) : undefined
    }
  });

  if (!ai.success) {
    throw new AppError(ai.error || "Falha do provedor de IA", 502);
  }

  return res.status(200).json({
    response: String(ai.result || "").trim(),
    provider: ai.provider,
    model: ai.model,
    processingTime: ai.processingTime
  });
};
