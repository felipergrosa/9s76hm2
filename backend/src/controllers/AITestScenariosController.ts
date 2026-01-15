import { Request, Response } from "express";
import AppError from "../errors/AppError";
import AIAgent from "../models/AIAgent";
import FunnelStage from "../models/FunnelStage";
import AIOrchestrator from "../services/IA/AIOrchestrator";
import AITestScenario from "../models/AITestScenario";
import AITestResult from "../models/AITestResult";

export const createScenario = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const { agentId, stageId, name, description, conversations } = req.body || {};

  if (!agentId || !stageId) {
    throw new AppError("agentId e stageId são obrigatórios", 400);
  }

  if (!name || !conversations || !Array.isArray(conversations) || conversations.length === 0) {
    throw new AppError("name e conversations são obrigatórios", 400);
  }

  const agent = await AIAgent.findOne({ where: { id: Number(agentId), companyId } });
  if (!agent) throw new AppError("ERR_AGENT_NOT_FOUND", 404);

  const stage = await FunnelStage.findOne({ where: { id: Number(stageId), agentId: agent.id } });
  if (!stage) throw new AppError("ERR_FUNNEL_STAGE_NOT_FOUND", 404);

  const scenario = await AITestScenario.create({
    companyId,
    userId: Number(userId),
    agentId: agent.id,
    stageId: stage.id,
    name: String(name).trim(),
    description: description ? String(description).trim() : null,
    conversations: JSON.stringify(conversations),
    status: "active"
  });

  return res.status(201).json({ scenario });
};

export const listScenarios = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { agentId, stageId } = req.query;

  const where: any = { companyId };
  if (agentId) where.agentId = Number(agentId);
  if (stageId) where.stageId = Number(stageId);

  const scenarios = await AITestScenario.findAll({
    where,
    order: [["createdAt", "DESC"]]
  });

  return res.status(200).json({ scenarios });
};

export const runScenario = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const { scenarioId } = req.params;
  const { promptOverride } = req.body || {};

  const scenario = await AITestScenario.findOne({
    where: { id: Number(scenarioId), companyId }
  });

  if (!scenario) throw new AppError("ERR_SCENARIO_NOT_FOUND", 404);

  const agent = await AIAgent.findOne({ where: { id: scenario.agentId, companyId } });
  if (!agent) throw new AppError("ERR_AGENT_NOT_FOUND", 404);

  const stage = await FunnelStage.findOne({ where: { id: scenario.stageId, agentId: agent.id } });
  if (!stage) throw new AppError("ERR_FUNNEL_STAGE_NOT_FOUND", 404);

  let conversations: Array<{ customer: string; expectedResponse: string }>;
  try {
    conversations = JSON.parse(scenario.conversations);
  } catch (e) {
    throw new AppError("Conversas do cenário inválidas", 400);
  }

  const systemPrompt = promptOverride || stage.systemPrompt || "";
  const results: Array<{
    index: number;
    customerMessage: string;
    expectedResponse: string;
    actualResponse: string;
    similarity: number;
    passed: boolean;
    toolCalls: string[];
  }> = [];

  const conversationHistory: Array<{ role: string; content: string }> = [];
  let totalSimilarity = 0;
  let passedCount = 0;

  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i];

    conversationHistory.push({ role: "user", content: conv.customer });

    const ai = await AIOrchestrator.processRequest({
      module: "general",
      mode: "chat",
      companyId,
      userId: userId ? Number(userId) : undefined,
      text: conv.customer,
      systemPrompt,
      preferProvider: agent.aiProvider || undefined,
      model: agent.aiModel || undefined,
      temperature: 0.3,
      maxTokens: agent.maxTokens || 1000,
      metadata: {
        testScenario: true,
        scenarioId: scenario.id,
        messageIndex: i,
        conversationHistory
      }
    });

    const actualResponse = ai.success ? String(ai.result || "").trim() : "[ERRO]";
    conversationHistory.push({ role: "assistant", content: actualResponse });

    const similarity = calculateSimilarity(conv.expectedResponse, actualResponse);
    const passed = similarity >= 70;

    totalSimilarity += similarity;
    if (passed) passedCount++;

    const toolCalls = extractToolCalls(actualResponse);

    results.push({
      index: i,
      customerMessage: conv.customer,
      expectedResponse: conv.expectedResponse,
      actualResponse,
      similarity,
      passed,
      toolCalls
    });
  }

  const overallScore = conversations.length > 0 ? Math.round(totalSimilarity / conversations.length) : 0;
  const passRate = conversations.length > 0 ? Math.round((passedCount / conversations.length) * 100) : 0;

  const testResult = await AITestResult.create({
    companyId,
    userId: Number(userId),
    scenarioId: scenario.id,
    agentId: agent.id,
    stageId: stage.id,
    promptUsed: systemPrompt,
    results: JSON.stringify(results),
    overallScore,
    passRate,
    totalTests: conversations.length,
    passedTests: passedCount
  });

  return res.status(200).json({
    ok: true,
    testResult: {
      id: testResult.id,
      overallScore,
      passRate,
      totalTests: conversations.length,
      passedTests: passedCount,
      results
    }
  });
};

export const getTestHistory = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { agentId, stageId, scenarioId, limit } = req.query;

  const where: any = { companyId };
  if (agentId) where.agentId = Number(agentId);
  if (stageId) where.stageId = Number(stageId);
  if (scenarioId) where.scenarioId = Number(scenarioId);

  const results = await AITestResult.findAll({
    where,
    order: [["createdAt", "DESC"]],
    limit: limit ? Number(limit) : 20
  });

  return res.status(200).json({
    results: results.map(r => ({
      ...r.toJSON(),
      results: JSON.parse(r.results || "[]")
    }))
  });
};

export const deleteScenario = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { scenarioId } = req.params;

  const scenario = await AITestScenario.findOne({
    where: { id: Number(scenarioId), companyId }
  });

  if (!scenario) throw new AppError("ERR_SCENARIO_NOT_FOUND", 404);

  await scenario.destroy();

  return res.status(200).json({ ok: true });
};

function calculateSimilarity(expected: string, actual: string): number {
  const exp = String(expected || "").toLowerCase().trim();
  const act = String(actual || "").toLowerCase().trim();

  if (exp === act) return 100;
  if (!exp || !act) return 0;

  const expWords = new Set(exp.split(/\s+/));
  const actWords = new Set(act.split(/\s+/));

  let commonWords = 0;
  for (const word of expWords) {
    if (actWords.has(word)) commonWords++;
  }

  const wordSimilarity = (commonWords / Math.max(expWords.size, actWords.size)) * 100;

  const expKeyPhrases = extractKeyPhrases(exp);
  const actKeyPhrases = extractKeyPhrases(act);

  let phraseMatch = 0;
  for (const phrase of expKeyPhrases) {
    if (act.includes(phrase)) phraseMatch++;
  }

  const phraseSimilarity = expKeyPhrases.length > 0 
    ? (phraseMatch / expKeyPhrases.length) * 100 
    : wordSimilarity;

  return Math.round((wordSimilarity * 0.4) + (phraseSimilarity * 0.6));
}

function extractKeyPhrases(text: string): string[] {
  const phrases: string[] = [];
  
  const sentences = text.split(/[.!?]+/).filter(Boolean);
  for (const s of sentences) {
    const trimmed = s.trim();
    if (trimmed.length > 10 && trimmed.length < 100) {
      phrases.push(trimmed.toLowerCase());
    }
  }
  
  return phrases.slice(0, 5);
}

function extractToolCalls(text: string): string[] {
  const toolCalls: string[] = [];
  
  const patterns = [
    /#\w+\([^)]*\)/g,
    /@\w+/g,
    /\[\[TOOL:([^\]]+)\]\]/g,
    /{{tool\.(\w+)}}/g
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      toolCalls.push(...matches);
    }
  }

  return [...new Set(toolCalls)];
}
