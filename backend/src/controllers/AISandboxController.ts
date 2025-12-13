import { Request, Response } from "express";
import crypto from "crypto";
import AIAgent from "../models/AIAgent";
import FunnelStage from "../models/FunnelStage";
import AIOrchestrator from "../services/IA/AIOrchestrator";

type SandboxRole = "customer" | "assistant";

type SandboxMessage = {
  role: SandboxRole;
  text: string;
  timestamp: string;
};

type SandboxSession = {
  id: string;
  companyId: number;
  userId: number;
  agentId: number;
  stageId: number;
  whatsappId?: number;
  groupId?: string;
  toNumber?: string;
  simulate?: boolean;
  promptOverride: string;
  createdAt: string;
  messages: SandboxMessage[];
};

const sessionsById = new Map<string, SandboxSession>();

const nowIso = () => new Date().toISOString();

const buildSystemPrompt = (params: {
  agent: AIAgent;
  stage: FunnelStage;
  promptOverride?: string;
}) => {
  const { agent, stage, promptOverride } = params;

  const parts: string[] = [];

  parts.push(`Você é um agente de IA chamado "${agent.name}".`);
  if (agent.profile) {
    parts.push(`Perfil: ${agent.profile}.`);
  }
  parts.push(`Etapa do funil: ${stage.name} (ordem ${stage.order}).`);

  if (agent.brandVoice) {
    parts.push(`Voz da marca: ${agent.brandVoice}`);
  }

  if (stage.tone) {
    parts.push(`Tom: ${stage.tone}.`);
  }

  if (stage.objective) {
    parts.push(`Objetivo: ${stage.objective}`);
  }

  if (stage.systemPrompt) {
    parts.push(stage.systemPrompt);
  }

  parts.push("Responda sempre em português (Brasil).");

  if (promptOverride && String(promptOverride).trim()) {
    parts.push("\nREGRAS/OVERRIDE (Sessão de Training):\n" + String(promptOverride).trim());
  }

  return parts.join("\n");
};

export const createSession = async (req: Request, res: Response) => {
  const { companyId, id: userId } = req.user;

  const { agentId, stageId, whatsappId, groupId, toNumber, simulate, promptOverride } = req.body || {};

  if (!agentId || !stageId) {
    return res.status(400).json({ error: "agentId e stageId são obrigatórios" });
  }

  const isSimulate = Boolean(simulate);

  if (!isSimulate && !whatsappId) {
    return res.status(400).json({ error: "whatsappId é obrigatório quando simulate=false" });
  }

  if (!isSimulate && !groupId && !toNumber) {
    return res.status(400).json({ error: "Informe groupId (Baileys) ou toNumber (Official) quando simulate=false" });
  }

  const agent = await AIAgent.findOne({
    where: { id: Number(agentId), companyId }
  });

  if (!agent) {
    return res.status(404).json({ error: "Agente não encontrado" });
  }

  const stage = await FunnelStage.findOne({
    where: { id: Number(stageId), agentId: agent.id }
  });

  if (!stage) {
    return res.status(404).json({ error: "Etapa do funil não encontrada" });
  }

  const sessionId = crypto.randomBytes(16).toString("hex");
  const session: SandboxSession = {
    id: sessionId,
    companyId,
    userId: Number(userId),
    agentId: Number(agentId),
    stageId: Number(stageId),
    whatsappId: whatsappId ? Number(whatsappId) : undefined,
    groupId: groupId ? String(groupId) : undefined,
    toNumber: toNumber ? String(toNumber) : undefined,
    simulate: isSimulate,
    promptOverride: String(promptOverride || ""),
    createdAt: nowIso(),
    messages: []
  };

  sessionsById.set(sessionId, session);

  return res.status(201).json({
    session: {
      id: session.id,
      agentId: session.agentId,
      stageId: session.stageId,
      whatsappId: session.whatsappId,
      groupId: session.groupId,
      toNumber: session.toNumber,
      simulate: session.simulate,
      promptOverride: session.promptOverride,
      createdAt: session.createdAt
    }
  });
};

export const sendMessage = async (req: Request, res: Response) => {
  const { companyId, id: userId } = req.user;
  const sessionId = String(req.params.sessionId || "");

  const { text } = req.body || {};

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Campo 'text' é obrigatório" });
  }

  const session = sessionsById.get(sessionId);

  if (!session || session.companyId !== companyId) {
    return res.status(404).json({ error: "Sessão não encontrada" });
  }

  const agent = await AIAgent.findOne({
    where: { id: session.agentId, companyId }
  });

  if (!agent) {
    return res.status(404).json({ error: "Agente não encontrado" });
  }

  const stage = await FunnelStage.findOne({
    where: { id: session.stageId, agentId: agent.id }
  });

  if (!stage) {
    return res.status(404).json({ error: "Etapa do funil não encontrada" });
  }

  const customerMsg: SandboxMessage = {
    role: "customer",
    text: text.trim(),
    timestamp: nowIso()
  };

  session.messages.push(customerMsg);

  const systemPrompt = buildSystemPrompt({
    agent,
    stage,
    promptOverride: session.promptOverride
  });

  const response = await AIOrchestrator.processRequest({
    module: "general",
    mode: "chat",
    companyId,
    userId: userId ? Number(userId) : undefined,
    text: customerMsg.text,
    systemPrompt,
    whatsappId: session.whatsappId || undefined,
    temperature: agent.temperature || undefined,
    maxTokens: agent.maxTokens || undefined,
    model: agent.aiModel || undefined,
    preferProvider: agent.aiProvider || undefined,
    metadata: {
      sandbox: true,
      sandboxSessionId: session.id,
      agentId: agent.id,
      stageId: session.stageId,
      groupId: session.groupId,
      toNumber: session.toNumber,
      simulate: session.simulate
    }
  });

  if (!response.success) {
    return res.status(500).json({
      error: response.error || "Erro no processamento IA",
      metadata: {
        provider: response.provider,
        model: response.model,
        processingTime: response.processingTime,
        requestId: response.requestId
      }
    });
  }

  const assistantText = String(response.result || "").trim();

  const assistantMsg: SandboxMessage = {
    role: "assistant",
    text: assistantText,
    timestamp: nowIso()
  };

  session.messages.push(assistantMsg);

  sessionsById.set(sessionId, session);

  return res.status(200).json({
    session: {
      id: session.id,
      agentId: session.agentId,
      stageId: session.stageId,
      whatsappId: session.whatsappId,
      groupId: session.groupId,
      toNumber: session.toNumber,
      simulate: session.simulate,
      promptOverride: session.promptOverride,
      createdAt: session.createdAt
    },
    message: assistantMsg,
    metadata: {
      provider: response.provider,
      model: response.model,
      processingTime: response.processingTime,
      ragUsed: response.ragUsed,
      requestId: response.requestId,
      timestamp: response.timestamp,
      systemPrompt
    }
  });
};
