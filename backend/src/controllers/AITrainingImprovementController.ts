import { Request, Response } from "express";
import AppError from "../errors/AppError";
import AIAgent from "../models/AIAgent";
import FunnelStage from "../models/FunnelStage";
import AITrainingImprovement from "../models/AITrainingImprovement";
import AIOrchestrator from "../services/IA/AIOrchestrator";
import { categorizeImprovement, analyzeErrorPatterns, generateProactiveSuggestions } from "../services/AIAgentServices/TrainingPatternAnalyzer";

const buildConsolidationSystemPrompt = () => {
  return [
    "Você é um assistente especialista em escrita de prompts para agentes de atendimento/vendas.",
    "Sua tarefa é consolidar um prompt existente com uma lista de melhorias incrementais.",
    "Regras:",
    "- Mantenha a estrutura e organização do prompt original (seções, títulos, ordem).",
    "- Integre as melhorias no local apropriado sem duplicar regras.",
    "- Se houver conflitos, priorize a melhoria mais recente.",
    "- Não crie informações novas: use apenas o prompt atual e as melhorias fornecidas.",
    "- Responda APENAS com o prompt final consolidado, sem explicações.",
  ].join("\n");
};

const buildConsolidationUserPrompt = (params: {
  currentPrompt: string;
  improvements: Array<{ id: number; improvementText: string }>;
}) => {
  const { currentPrompt, improvements } = params;

  const improvementsText = improvements
    .map((i, idx) => `#${idx + 1} (id=${i.id})\n${String(i.improvementText).trim()}`)
    .join("\n\n");

  return [
    "PROMPT_ATUAL:\n" + String(currentPrompt || "").trim(),
    "\n\nMELHORIAS (em ordem, da mais antiga para a mais nova):\n" + improvementsText,
    "\n\nENTREGUE O PROMPT CONSOLIDADO FINAL:" 
  ].join("\n");
};

export const createImprovement = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;

  const { agentId, stageId, feedbackId, improvementText } = req.body || {};

  if (!agentId || !stageId) {
    throw new AppError("agentId e stageId são obrigatórios", 400);
  }

  if (!improvementText || typeof improvementText !== "string" || !String(improvementText).trim()) {
    throw new AppError("improvementText é obrigatório", 400);
  }

  const agent = await AIAgent.findOne({ where: { id: Number(agentId), companyId } });
  if (!agent) throw new AppError("ERR_AGENT_NOT_FOUND", 404);

  const stage = await FunnelStage.findOne({ where: { id: Number(stageId), agentId: agent.id } });
  if (!stage) throw new AppError("ERR_FUNNEL_STAGE_NOT_FOUND", 404);

  const improvement = await AITrainingImprovement.create({
    companyId,
    userId: Number(userId),
    agentId: agent.id,
    stageId: stage.id,
    feedbackId: feedbackId ? Number(feedbackId) : null,
    improvementText: String(improvementText).trim(),
    category: null,
    severity: null,
    intentDetected: null,
    verifiedInProduction: false,
    status: "pending",
    appliedAt: null,
    consolidatedPrompt: null
  });

  // Categoriza de forma assíncrona (não bloqueia a resposta)
  categorizeImprovement(companyId, improvementText)
    .then(async (categorization) => {
      await improvement.update({
        category: categorization.category,
        severity: categorization.severity,
        intentDetected: categorization.intentDetected
      });
    })
    .catch(err => console.error("Erro ao categorizar melhoria:", err));

  return res.status(201).json({ improvement });
};

export const applyImprovements = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;

  const { agentId, stageId } = req.body || {};

  if (!agentId || !stageId) {
    throw new AppError("agentId e stageId são obrigatórios", 400);
  }

  const agent = await AIAgent.findOne({ where: { id: Number(agentId), companyId } });
  if (!agent) throw new AppError("ERR_AGENT_NOT_FOUND", 404);

  const stage = await FunnelStage.findOne({ where: { id: Number(stageId), agentId: agent.id } });
  if (!stage) throw new AppError("ERR_FUNNEL_STAGE_NOT_FOUND", 404);

  const improvements = await AITrainingImprovement.findAll({
    where: {
      companyId,
      agentId: agent.id,
      stageId: stage.id,
      status: "pending"
    },
    order: [["id", "ASC"]]
  });

  if (!improvements.length) {
    return res.status(200).json({
      ok: true,
      applied: 0,
      systemPrompt: stage.systemPrompt
    });
  }

  const systemPrompt = buildConsolidationSystemPrompt();
  const userPrompt = buildConsolidationUserPrompt({
    currentPrompt: stage.systemPrompt || "",
    improvements: improvements.map(i => ({ id: i.id, improvementText: i.improvementText }))
  });

  const ai = await AIOrchestrator.processRequest({
    module: "prompt",
    mode: "chat",
    companyId,
    userId: userId ? Number(userId) : undefined,
    text: userPrompt,
    systemPrompt,
    preferProvider: agent.aiProvider || undefined,
    model: agent.aiModel || undefined,
    temperature: 0.2,
    maxTokens: agent.maxTokens || undefined,
    metadata: {
      training: true,
      trainingType: "prompt_consolidation",
      agentId: agent.id,
      stageId: stage.id,
      improvementsCount: improvements.length
    }
  });

  if (!ai.success) {
    throw new AppError(ai.error || "Falha ao consolidar prompt", 500);
  }

  const consolidated = String(ai.result || "").trim();
  if (!consolidated) {
    throw new AppError("Consolidação retornou vazia", 500);
  }

  await stage.update({ systemPrompt: consolidated });

  const appliedAt = new Date();
  for (const imp of improvements) {
    await imp.update({
      status: "applied",
      appliedAt,
      consolidatedPrompt: consolidated
    });
  }

  return res.status(200).json({
    ok: true,
    applied: improvements.length,
    systemPrompt: consolidated
  });
};

/**
 * Analisa padrões de erro nos feedbacks de treinamento
 */
export const getPatternAnalysis = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const agentId = Number(req.query.agentId);
  const stageId = req.query.stageId ? Number(req.query.stageId) : undefined;
  const daysBack = req.query.daysBack ? Number(req.query.daysBack) : 30;

  if (!agentId) {
    throw new AppError("agentId é obrigatório", 400);
  }

  const agent = await AIAgent.findOne({ where: { id: agentId, companyId } });
  if (!agent) throw new AppError("ERR_AGENT_NOT_FOUND", 404);

  const analysis = await analyzeErrorPatterns(companyId, agentId, stageId, daysBack);

  return res.status(200).json(analysis);
};

/**
 * Gera sugestões proativas de melhoria baseadas em padrões históricos
 */
export const getProactiveSuggestions = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const agentId = Number(req.query.agentId);

  if (!agentId) {
    throw new AppError("agentId é obrigatório", 400);
  }

  const agent = await AIAgent.findOne({ where: { id: agentId, companyId } });
  if (!agent) throw new AppError("ERR_AGENT_NOT_FOUND", 404);

  // Busca prompt atual da primeira etapa
  const stages = await FunnelStage.findAll({ 
    where: { agentId: agent.id }, 
    order: [["order", "ASC"]], 
    limit: 1 
  });

  const currentPrompt = stages[0]?.systemPrompt || "";

  const suggestions = await generateProactiveSuggestions(companyId, agentId, currentPrompt);

  return res.status(200).json({ suggestions });
};

/**
 * Lista melhorias por categoria
 */
export const getImprovementsByCategory = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const agentId = Number(req.query.agentId);
  const category = req.query.category as string;

  if (!agentId) {
    throw new AppError("agentId é obrigatório", 400);
  }

  const whereClause: any = { companyId, agentId };
  if (category) whereClause.category = category;

  const improvements = await AITrainingImprovement.findAll({
    where: whereClause,
    order: [["createdAt", "DESC"]],
    limit: 50
  });

  // Agrupa por categoria
  const grouped = improvements.reduce((acc, imp) => {
    const cat = imp.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(imp);
    return acc;
  }, {} as Record<string, AITrainingImprovement[]>);

  return res.status(200).json({ grouped, total: improvements.length });
};
