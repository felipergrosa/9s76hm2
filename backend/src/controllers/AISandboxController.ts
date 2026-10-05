import { Request, Response } from "express";
import crypto from "crypto";
import AIAgent from "../models/AIAgent";
import FunnelStage from "../models/FunnelStage";
import Whatsapp from "../models/Whatsapp";
import AISandboxSession, { AISandboxMessage } from "../models/AISandboxSession";
import AIOrchestrator from "../services/IA/AIOrchestrator";
import skillCache from "../services/IA/SkillCacheService";
import generateCustomSkillsPrompt from "../services/IA/CustomSkillPrompt";
import { DEFAULT_SKILLS, generateSkillsPrompt } from "../services/IA/AISkill";
import { getWbot } from "../libs/wbot";
import logger from "../utils/logger";

// Sessões de sandbox expiram em 24h (persistidas em AISandboxSessions)
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const nowIso = () => new Date().toISOString();

const isExpired = (session: AISandboxSession): boolean =>
  !!session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now();

const serializeSession = (session: AISandboxSession) => ({
  id: session.id,
  agentId: session.agentId,
  stageId: session.stageId,
  whatsappId: session.whatsappId,
  groupId: session.groupId,
  toNumber: session.toNumber,
  simulate: session.simulate,
  promptOverride: session.promptOverride,
  expiresAt: session.expiresAt,
  createdAt: session.createdAt
});

/**
 * Monta o system prompt do sandbox reproduzindo, na medida do possível,
 * o resolveSystemPromptForTicket do OpenAiService (produção) — sem
 * depender de ticket/contato real: identidade do agente, etapa do funil,
 * bloco de skills padrão + skills customizadas ativas (via skillCache) e
 * o promptOverride da sessão (deduplicado contra stage.systemPrompt).
 */
export const buildSandboxSystemPrompt = async (params: {
  agent: AIAgent;
  stage: FunnelStage;
  companyId: number;
  promptOverride?: string;
}): Promise<string> => {
  const { agent, stage, companyId, promptOverride } = params;

  // Skills customizadas — mesma lógica de OpenAiService.ts
  // (skillCache.getSkills + filtro status "active" && enabled)
  let customSkillsBlock = "";
  try {
    const dbSkills = await skillCache.getSkills(companyId, agent.id);
    const activeSkills = dbSkills.filter(s => s.status === "active" && s.enabled);
    customSkillsBlock = generateCustomSkillsPrompt(activeSkills);
  } catch (skillError) {
    logger.error("[AISandbox] Erro ao buscar skills personalizadas:", skillError);
  }

  const stagePrompt = String(stage.systemPrompt || "").trim();
  const override = String(promptOverride || "").trim();

  // O frontend costuma enviar o prompt da etapa como promptOverride —
  // dedupe por trim-compare para não duplicar o texto no system prompt.
  const effectiveOverride = override && override !== stagePrompt ? override : "";

  return `Instruções do Sistema:
  - Seu nome é ${agent.name}. Se perguntarem quem você é ou qual seu nome, responda: "Meu nome é ${agent.name}".
  ${agent.profile ? `- Perfil do agente: ${agent.profile}.` : ""}
  - Etapa do atendimento: ${stage.name} (ordem ${stage.order})${stage.objective ? ` - ${stage.objective}` : ""}
  - Tom de comunicação: ${stage.tone || "Profissional"}
  ${agent.brandVoice ? `- Voz da marca: ${agent.brandVoice}` : ""}
  - Contexto de simulação (sandbox): dados de CRM, memória de contato, horário de funcionamento e execução de funções reais não estão disponíveis.

  // ========== BLOCO DE SKILLS ==========
  ${generateSkillsPrompt(DEFAULT_SKILLS)}
  ${customSkillsBlock}

  Prompt Específico do Agente (etapa "${stage.name}"):
  ${stage.systemPrompt || ""}
  ${effectiveOverride ? `\n  REGRAS/OVERRIDE (Sessão de Training):\n  ${effectiveOverride}\n` : ""}
  Siga essas instruções com cuidado para garantir um atendimento claro, personalizado e amigável em todas as respostas.
  Responda sempre em português (Brasil).`;
};

/**
 * Envio real (simulate=false) via conexão Baileys — best-effort:
 * qualquer falha propaga para o caller responder 500 com erro visível.
 * Não cria Ticket nem Message — é sandbox, só entrega a mensagem.
 */
const sendRealWhatsAppMessage = async (
  session: AISandboxSession,
  text: string
): Promise<void> => {
  let jid: string;

  if (session.groupId) {
    // JID de grupo Baileys — se já vier com sufixo @g.us, usa direto
    jid = session.groupId.includes("@")
      ? session.groupId
      : `${session.groupId}@g.us`;
  } else {
    const digits = String(session.toNumber || "").replace(/\D/g, "");
    if (!digits) {
      throw new Error("Destino inválido para envio real (toNumber vazio)");
    }
    jid = `${digits}@s.whatsapp.net`;
  }

  // getWbot lança AppError se a sessão Baileys não estiver inicializada
  const wbot = getWbot(Number(session.whatsappId));
  await wbot.sendMessage(jid, { text });
};

const loadSessionOr404 = async (
  sessionId: string,
  companyId: number,
  res: Response
): Promise<AISandboxSession | null> => {
  const session = await AISandboxSession.findOne({
    where: { id: sessionId, companyId }
  });

  if (!session) {
    res.status(404).json({ error: "Sessão não encontrada" });
    return null;
  }

  if (isExpired(session)) {
    res.status(404).json({ error: "Sessão expirada" });
    return null;
  }

  return session;
};

export const createSession = async (req: Request, res: Response) => {
  const { companyId, id: userId } = req.user;

  const { agentId, stageId, whatsappId, groupId, toNumber, simulate, promptOverride } = req.body || {};

  if (!agentId || !stageId) {
    return res.status(400).json({ error: "agentId e stageId são obrigatórios" });
  }

  // simulate é opcional — default true (consistente com a coluna do model)
  const isSimulate = simulate === undefined || simulate === null ? true : Boolean(simulate);

  if (!isSimulate && !whatsappId) {
    return res.status(400).json({ error: "whatsappId é obrigatório quando simulate=false" });
  }

  if (!isSimulate && !groupId && !toNumber) {
    return res.status(400).json({ error: "Informe groupId (Baileys) ou toNumber (Official) quando simulate=false" });
  }

  // Envio real (simulate=false): o whatsappId precisa ser uma conexão do
  // tenant — caso contrário o sandbox poderia disparar mensagens por uma
  // conexão de outra empresa.
  if (!isSimulate && whatsappId) {
    const whatsapp = await Whatsapp.findOne({
      where: { id: Number(whatsappId), companyId }
    });
    if (!whatsapp) {
      return res.status(404).json({ error: "Conexão WhatsApp não encontrada" });
    }

    // Envio real implementado apenas via Baileys (wbot.sendMessage). O
    // fluxo oficial exige Ticket/janela de sessão — indisponível em sandbox.
    if (whatsapp.channelType === "official" || (whatsapp as any).isOfficial) {
      return res.status(400).json({ error: "Envio real suportado apenas em conexões Baileys" });
    }
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

  const session = await AISandboxSession.create({
    id: crypto.randomBytes(16).toString("hex"),
    companyId,
    userId: Number(userId),
    agentId: Number(agentId),
    stageId: Number(stageId),
    whatsappId: whatsappId ? Number(whatsappId) : null,
    groupId: groupId ? String(groupId) : null,
    toNumber: toNumber ? String(toNumber) : null,
    simulate: isSimulate,
    promptOverride: String(promptOverride || ""),
    messages: [],
    expiresAt: new Date(Date.now() + SESSION_TTL_MS)
  } as any);

  return res.status(201).json({
    session: serializeSession(session)
  });
};

export const getSession = async (req: Request, res: Response) => {
  const { companyId } = req.user;
  const sessionId = String(req.params.sessionId || "");

  const session = await loadSessionOr404(sessionId, companyId, res);
  if (!session) return;

  return res.status(200).json({
    session: serializeSession(session),
    messages: session.messages || []
  });
};

export const sendMessage = async (req: Request, res: Response) => {
  const { companyId, id: userId } = req.user;
  const sessionId = String(req.params.sessionId || "");

  const { text } = req.body || {};

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Campo 'text' é obrigatório" });
  }

  const session = await loadSessionOr404(sessionId, companyId, res);
  if (!session) return;

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

  // Histórico: mensagens anteriores da sessão mapeadas para o contrato
  // do orquestrador ("customer" vira "user"; a mensagem atual vai em `text`)
  const history = (session.messages || [])
    .map(m => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: m.text
    }));

  const customerMsg: AISandboxMessage = {
    role: "customer",
    text: text.trim(),
    timestamp: nowIso()
  };

  // Persiste a mensagem do cliente antes de chamar a IA (espelha a
  // produção, onde o inbound é gravado antes do processamento)
  session.messages = [...(session.messages || []), customerMsg];
  await session.save();

  const systemPrompt = await buildSandboxSystemPrompt({
    agent,
    stage,
    companyId,
    promptOverride: session.promptOverride
  });

  const response = await AIOrchestrator.processRequest({
    module: "training",
    mode: "chat",
    companyId,
    userId: userId ? Number(userId) : undefined,
    text: customerMsg.text,
    history,
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

  const assistantMsg: AISandboxMessage = {
    role: "assistant",
    text: assistantText,
    timestamp: nowIso()
  };

  // Envio real (simulate=false): entrega a resposta do assistente de
  // verdade via Baileys. Best-effort com erro visível — falha vira 500.
  if (!session.simulate) {
    try {
      await sendRealWhatsAppMessage(session, assistantText);
    } catch (sendError: any) {
      logger.error("[AISandbox] Falha no envio real da mensagem do sandbox:", {
        sessionId: session.id,
        whatsappId: session.whatsappId,
        error: sendError?.message
      });
      return res.status(500).json({
        error: `Falha ao enviar mensagem real no WhatsApp: ${sendError?.message || "erro desconhecido"}`
      });
    }
  }

  session.messages = [...(session.messages || []), assistantMsg];
  await session.save();

  // Hash curto do system prompt para o frontend detectar mudanças de
  // prompt entre turnos da mesma sessão
  const usedPromptHash = crypto
    .createHash("sha256")
    .update(systemPrompt)
    .digest("hex")
    .substring(0, 8);

  return res.status(200).json({
    session: serializeSession(session),
    message: assistantMsg,
    metadata: {
      provider: response.provider,
      model: response.model,
      processingTime: response.processingTime,
      ragUsed: response.ragUsed,
      requestId: response.requestId,
      timestamp: response.timestamp,
      messageCount: session.messages.length,
      usedPromptHash,
      systemPrompt
    }
  });
};
