import { Request, Response } from "express";
import AppError from "../errors/AppError";
import sequelize from "../database";
import AIAgent from "../models/AIAgent";
import FunnelStage from "../models/FunnelStage";
import AITrainingFeedback from "../models/AITrainingFeedback";
import AITrainingImprovement from "../models/AITrainingImprovement";
import Skill from "../models/Skill";
import skillCache from "../services/IA/SkillCacheService";
import buildImprovementText from "../utils/buildImprovementText";
import { categorizeImprovement, analyzeErrorPatterns, generateProactiveSuggestions } from "../services/AIAgentServices/TrainingPatternAnalyzer";

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

  let finalText = String(improvementText).trim();

  if (feedbackId) {
    const feedback = await AITrainingFeedback.findOne({
      where: { id: Number(feedbackId), companyId }
    });
    if (!feedback) throw new AppError("ERR_FEEDBACK_NOT_FOUND", 404);

    // Se o improvement manual não embute a correção do feedback, anexa
    // usando o mesmo formato do loop automático.
    const suffix = buildImprovementText({
      customerText: null,
      correctedText:
        feedback.correctedText && !finalText.includes(feedback.correctedText)
          ? feedback.correctedText
          : null,
      explanation:
        feedback.explanation && !finalText.includes(feedback.explanation)
          ? feedback.explanation
          : null
    });
    if (suffix) {
      finalText = `${finalText} ${suffix}`;
    }
  }

  const improvement = await AITrainingImprovement.create({
    companyId,
    userId: Number(userId),
    agentId: agent.id,
    stageId: stage.id,
    feedbackId: feedbackId ? Number(feedbackId) : null,
    improvementText: finalText,
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

  // Decisão de produto: melhoria aplicada vira SKILL do agente, não rewrite
  // do prompt. As skills customizadas já são injetadas no prompt real em
  // produção — sem chamada LLM de consolidação aqui.
  const skills: Array<{ id: number; name: string; description: string }> = [];

  await sequelize.transaction(async t => {
    const improvements = await AITrainingImprovement.findAll({
      where: {
        companyId,
        agentId: agent.id,
        stageId: stage.id,
        status: "pending"
      },
      order: [["id", "ASC"]],
      transaction: t
    });

    if (!improvements.length) return;

    // Dedupe via metadata JSONB (filter em JS: mais simples e portável
    // que operador ->> do Postgres dentro do where do Sequelize v5).
    const existingSkills = await Skill.findAll({
      where: { companyId, agentId: agent.id },
      transaction: t
    });

    const appliedAt = new Date();

    for (const imp of improvements) {
      let skill = existingSkills.find(
        s => (s.metadata as any)?.improvementId === imp.id
      );

      if (!skill) {
        skill = await Skill.create({
          companyId,
          agentId: agent.id,
          name: `aprendizado-${imp.category || "geral"}-${imp.id}`,
          category: "custom",
          description: imp.improvementText,
          triggers: [],
          examples: [],
          functions: [],
          conditions: [],
          priority: 7,
          enabled: true,
          status: "active",
          metadata: {
            source: "training",
            improvementId: imp.id,
            feedbackId: imp.feedbackId,
            stageId: stage.id,
            createdBy: Number(userId)
          } as any
        }, { transaction: t });
      }

      skills.push({ id: skill.id, name: skill.name, description: skill.description });

      await imp.update(
        { status: "applied", appliedAt },
        { transaction: t }
      );
    }
  });

  // Hot-reload: invalida o cache de skills do agente para o bloco de
  // skills customizadas refletir as melhorias no próximo prompt.
  skillCache.invalidate(companyId, agent.id);

  return res.status(200).json({
    ok: true,
    applied: skills.length,
    skills
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
  const stageId = req.query.stageId ? Number(req.query.stageId) : undefined;

  if (!agentId) {
    throw new AppError("agentId é obrigatório", 400);
  }

  const agent = await AIAgent.findOne({ where: { id: agentId, companyId } });
  if (!agent) throw new AppError("ERR_AGENT_NOT_FOUND", 404);

  // Usa o prompt da etapa informada; sem stageId cai na primeira etapa
  // (comportamento anterior).
  let stage: FunnelStage | null = null;
  if (stageId) {
    stage = await FunnelStage.findOne({ where: { id: stageId, agentId: agent.id } });
    if (!stage) throw new AppError("ERR_FUNNEL_STAGE_NOT_FOUND", 404);
  } else {
    stage = await FunnelStage.findOne({
      where: { agentId: agent.id },
      order: [["order", "ASC"]]
    });
  }

  const currentPrompt = stage?.systemPrompt || "";

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

/**
 * Lista paginada de melhorias de treinamento
 */
export const listImprovements = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const agentId = Number(req.query.agentId);
  if (!agentId) {
    throw new AppError("agentId é obrigatório", 400);
  }

  const where: any = { companyId, agentId };
  if (req.query.stageId) where.stageId = Number(req.query.stageId);
  if (req.query.status) where.status = String(req.query.status);

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const { rows: improvements, count: total } = await AITrainingImprovement.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
    offset
  });

  return res.status(200).json({
    improvements,
    total,
    page,
    pages: Math.ceil(total / limit)
  });
};
