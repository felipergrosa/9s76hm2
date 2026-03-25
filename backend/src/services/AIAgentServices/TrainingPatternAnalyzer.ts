import AITrainingFeedback from "../../models/AITrainingFeedback";
import AITrainingImprovement from "../../models/AITrainingImprovement";
import AIOrchestrator from "../IA/AIOrchestrator";

interface PatternAnalysis {
  topErrorCategories: Array<{ category: string; count: number; examples: string[] }>;
  commonIntents: Array<{ intent: string; errorRate: number }>;
  suggestions: Array<{ type: string; description: string; priority: "high" | "medium" | "low" }>;
  overallAccuracy: number;
  trendDirection: "improving" | "declining" | "stable";
}

interface CategorizationResult {
  category: "tone" | "accuracy" | "empathy" | "sales" | "routing" | "knowledge" | "formatting" | "other";
  severity: "low" | "medium" | "high";
  intentDetected: string | null;
}

/**
 * Analisa padrões de erro nos feedbacks de treinamento
 * para identificar áreas que precisam de melhorias sistemáticas
 */
export const analyzeErrorPatterns = async (
  companyId: number,
  agentId: number,
  stageId?: number,
  daysBack: number = 30
): Promise<PatternAnalysis> => {
  const whereClause: any = { 
    companyId, 
    agentId, 
    rating: "wrong",
    createdAt: {
      $gte: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    }
  };

  if (stageId) whereClause.stageId = stageId;

  const wrongFeedbacks = await AITrainingFeedback.findAll({
    where: whereClause,
    order: [["createdAt", "DESC"]],
    limit: 100
  });

  const correctCount = await AITrainingFeedback.count({
    where: { ...whereClause, rating: "correct" }
  });

  const wrongCount = wrongFeedbacks.length;
  const total = correctCount + wrongCount;
  const overallAccuracy = total > 0 ? (correctCount / total) * 100 : 0;

  // Agrupa por padrões similares usando IA
  const patternsPrompt = buildPatternsPrompt(wrongFeedbacks);

  const ai = await AIOrchestrator.processRequest({
    module: "training",
    mode: "chat",
    companyId,
    text: patternsPrompt,
    systemPrompt: buildPatternsSystemPrompt(),
    temperature: 0.3,
    maxTokens: 1000
  });

  // Parse da resposta da IA
  const patterns = parsePatternsResponse(ai.result || "");

  // Calcula tendência (últimos 7 dias vs 7 dias anteriores)
  const recentWrong = await AITrainingFeedback.count({
    where: { 
      ...whereClause, 
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
    }
  });

  const previousWrong = await AITrainingFeedback.count({
    where: { 
      ...whereClause, 
      createdAt: { 
        $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      } 
    }
  });

  const trendDirection: "improving" | "declining" | "stable" = 
    recentWrong < previousWrong * 0.8 ? "improving" :
    recentWrong > previousWrong * 1.2 ? "declining" : "stable";

  return {
    topErrorCategories: patterns.topErrorCategories || [],
    commonIntents: patterns.commonIntents || [],
    suggestions: patterns.suggestions || [],
    overallAccuracy,
    trendDirection
  };
};

/**
 * Categoriza automaticamente uma melhoria usando IA
 */
export const categorizeImprovement = async (
  companyId: number,
  improvementText: string,
  customerText?: string | null,
  assistantText?: string | null
): Promise<CategorizationResult> => {
  const prompt = [
    "Analise esta correção de resposta de um agente de IA e categorize:",
    "",
    improvementText,
    "",
    customerText ? `Pergunta do cliente: ${customerText}` : "",
    assistantText ? `Resposta do agente: ${assistantText}` : "",
    "",
    "Responda APENAS em JSON:",
    "{",
    '  "category": "tone|accuracy|empathy|sales|routing|knowledge|formatting|other",',
    '  "severity": "low|medium|high",',
    '  "intentDetected": "intenção detectada ou null"',
    "}"
  ].filter(Boolean).join("\n");

  const ai = await AIOrchestrator.processRequest({
    module: "training",
    mode: "chat",
    companyId,
    text: prompt,
    systemPrompt: "Você é um especialista em análise de conversas de atendimento. Responda apenas em JSON válido.",
    temperature: 0.1,
    maxTokens: 100
  });

  try {
    const parsed = JSON.parse(ai.result || "{}");
    return {
      category: parsed.category || "other",
      severity: parsed.severity || "medium",
      intentDetected: parsed.intentDetected || null
    };
  } catch {
    return { category: "other", severity: "medium", intentDetected: null };
  }
};

/**
 * Gera sugestões proativas de melhoria baseadas em padrões históricos
 */
export const generateProactiveSuggestions = async (
  companyId: number,
  agentId: number,
  currentPrompt: string
): Promise<Array<{ type: string; description: string; reasoning: string }>> => {
  // Busca padrões de erro
  const patterns = await analyzeErrorPatterns(companyId, agentId, undefined, 30);

  // Busca melhorias já aplicadas
  const appliedImprovements = await AITrainingImprovement.findAll({
    where: { companyId, agentId, status: "applied" },
    order: [["appliedAt", "DESC"]],
    limit: 20
  });

  const prompt = [
    "Com base nos padrões de erro identificados e no prompt atual, sugira melhorias proativas:",
    "",
    "PADRÕES DE ERRO:",
    JSON.stringify(patterns.topErrorCategories, null, 2),
    "",
    "MELHORIAS JÁ APLICADAS (evite duplicar):",
    appliedImprovements.map(i => `- ${i.improvementText}`).join("\n"),
    "",
    "PROMPT ATUAL:",
    currentPrompt.substring(0, 2000),
    "",
    "Responda em JSON array com 3-5 sugestões:",
    "[{",
    '  "type": "addition|modification|removal",',
    '  "description": "descrição da melhoria",',
    '  "reasoning": "por que esta melhoria é necessária"',
    "}]"
  ].join("\n");

  const ai = await AIOrchestrator.processRequest({
    module: "training",
    mode: "chat",
    companyId,
    text: prompt,
    systemPrompt: "Você é um especialista em otimização de prompts para agentes de atendimento. Responda apenas em JSON válido.",
    temperature: 0.4,
    maxTokens: 500
  });

  try {
    return JSON.parse(ai.result || "[]");
  } catch {
    return [];
  }
};

// Helpers
const buildPatternsSystemPrompt = (): string => {
  return [
    "Você é um analista de dados especializado em identificar padrões em conversas de atendimento.",
    "Analise os erros reportados e identifique:",
    "1. Categorias de erro mais comuns",
    "2. Intenções que geram mais erros",
    "3. Sugestões de correção sistemática",
    "",
    "Responda APENAS em JSON válido com esta estrutura:",
    "{",
    '  "topErrorCategories": [{ "category": "nome", "count": 0, "examples": ["ex1", "ex2"] }],',
    '  "commonIntents": [{ "intent": "nome", "errorRate": 0.5 }],',
    '  "suggestions": [{ "type": "tipo", "description": "desc", "priority": "high|medium|low" }]',
    "}"
  ].join("\n");
};

const buildPatternsPrompt = (feedbacks: AITrainingFeedback[]): string => {
  const examples = feedbacks.slice(0, 20).map(f => ({
    customer: f.customerText?.substring(0, 200),
    wrong: f.assistantText?.substring(0, 200),
    correct: f.correctedText?.substring(0, 200),
    explanation: f.explanation?.substring(0, 200)
  }));

  return [
    "Analise estes erros de resposta do agente:",
    "",
    JSON.stringify(examples, null, 2)
  ].join("\n");
};

const parsePatternsResponse = (response: string): Partial<PatternAnalysis> => {
  try {
    return JSON.parse(response);
  } catch {
    return {
      topErrorCategories: [],
      commonIntents: [],
      suggestions: []
    };
  }
};

export default {
  analyzeErrorPatterns,
  categorizeImprovement,
  generateProactiveSuggestions
};
