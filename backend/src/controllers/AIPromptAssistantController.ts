import { Request, Response } from "express";
import AppError from "../errors/AppError";
import AIAgent from "../models/AIAgent";
import FunnelStage from "../models/FunnelStage";
import AIOrchestrator from "../services/IA/AIOrchestrator";

export const rewritePrompt = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const { currentPrompt, command, agentId } = req.body || {};

  if (!currentPrompt || typeof currentPrompt !== "string") {
    throw new AppError("currentPrompt é obrigatório", 400);
  }

  if (!command || typeof command !== "string" || !command.trim()) {
    throw new AppError("command é obrigatório", 400);
  }

  let agent = null;
  if (agentId) {
    agent = await AIAgent.findOne({ where: { id: Number(agentId), companyId } });
  }

  const systemPrompt = [
    "Você é um assistente especialista em engenharia de prompts para agentes de atendimento e vendas.",
    "Sua tarefa é reescrever/modificar o prompt atual baseado no comando do usuário.",
    "Regras:",
    "- Mantenha a estrutura e organização do prompt original quando possível.",
    "- Aplique APENAS as modificações solicitadas no comando.",
    "- Preserve variáveis como {{nome}}, {{email}}, @agentes, #ferramentas.",
    "- Seja criativo mas mantenha a coerência com o objetivo do agente.",
    "- Responda APENAS com o prompt modificado, sem explicações ou comentários.",
  ].join("\n");

  const userPrompt = [
    "PROMPT ATUAL:",
    String(currentPrompt).trim(),
    "",
    "COMANDO DO USUÁRIO:",
    String(command).trim(),
    "",
    "ENTREGUE O PROMPT MODIFICADO:"
  ].join("\n");

  const ai = await AIOrchestrator.processRequest({
    module: "prompt",
    mode: "chat",
    companyId,
    userId: userId ? Number(userId) : undefined,
    text: userPrompt,
    systemPrompt,
    preferProvider: agent?.aiProvider || undefined,
    model: agent?.aiModel || undefined,
    temperature: 0.4,
    maxTokens: agent?.maxTokens || 4000,
    metadata: {
      assistantType: "prompt_rewrite",
      command
    }
  });

  if (!ai.success) {
    throw new AppError(ai.error || "Falha ao reescrever prompt", 500);
  }

  const rewrittenPrompt = String(ai.result || "").trim();
  if (!rewrittenPrompt) {
    throw new AppError("Resposta vazia da IA", 500);
  }

  return res.status(200).json({
    ok: true,
    originalPrompt: currentPrompt,
    command,
    rewrittenPrompt,
    metadata: {
      provider: ai.provider,
      model: ai.model,
      processingTime: ai.processingTime
    }
  });
};

export const suggestImprovements = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const { currentPrompt, agentId, context } = req.body || {};

  if (!currentPrompt || typeof currentPrompt !== "string") {
    throw new AppError("currentPrompt é obrigatório", 400);
  }

  let agent = null;
  if (agentId) {
    agent = await AIAgent.findOne({ where: { id: Number(agentId), companyId } });
  }

  const systemPrompt = [
    "Você é um especialista em engenharia de prompts para agentes de IA de atendimento/vendas.",
    "Analise o prompt fornecido e sugira melhorias específicas e acionáveis.",
    "Responda em formato JSON com a seguinte estrutura:",
    "{",
    '  "score": 0-100,',
    '  "strengths": ["ponto forte 1", "ponto forte 2"],',
    '  "weaknesses": ["fraqueza 1", "fraqueza 2"],',
    '  "suggestions": [',
    '    {"type": "tom", "description": "descrição", "example": "exemplo de como aplicar"},',
    '    {"type": "clareza", "description": "descrição", "example": "exemplo"}',
    "  ],",
    '  "quickFixes": ["comando 1 para melhorar", "comando 2 para melhorar"]',
    "}",
    "Tipos possíveis: tom, clareza, estrutura, persuasao, personalizacao, seguranca, performance"
  ].join("\n");

  const userPrompt = [
    "PROMPT PARA ANÁLISE:",
    String(currentPrompt).trim(),
    context ? `\nCONTEXTO ADICIONAL: ${context}` : "",
    "\nANALISE E SUGIRA MELHORIAS (JSON):"
  ].join("\n");

  const ai = await AIOrchestrator.processRequest({
    module: "prompt",
    mode: "chat",
    companyId,
    userId: userId ? Number(userId) : undefined,
    text: userPrompt,
    systemPrompt,
    preferProvider: agent?.aiProvider || undefined,
    model: agent?.aiModel || undefined,
    temperature: 0.3,
    maxTokens: 2000,
    metadata: {
      assistantType: "prompt_analysis"
    }
  });

  if (!ai.success) {
    throw new AppError(ai.error || "Falha ao analisar prompt", 500);
  }

  let analysis;
  try {
    const responseText = String(ai.result || "").trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("JSON não encontrado na resposta");
    }
  } catch (e) {
    analysis = {
      score: 50,
      strengths: [],
      weaknesses: ["Não foi possível analisar o prompt"],
      suggestions: [],
      quickFixes: [],
      rawResponse: ai.result
    };
  }

  return res.status(200).json({
    ok: true,
    analysis,
    metadata: {
      provider: ai.provider,
      model: ai.model,
      processingTime: ai.processingTime
    }
  });
};

export const getPromptVariables = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { agentId } = req.query;

  const variables = {
    contact: [
      { key: "{{contact.name}}", description: "Nome do contato" },
      { key: "{{contact.email}}", description: "Email do contato" },
      { key: "{{contact.phone}}", description: "Telefone do contato" },
      { key: "{{contact.cpf}}", description: "CPF do contato" },
    ],
    ticket: [
      { key: "{{ticket.id}}", description: "ID do ticket" },
      { key: "{{ticket.status}}", description: "Status do ticket" },
      { key: "{{ticket.queue}}", description: "Fila do ticket" },
      { key: "{{ticket.protocol}}", description: "Protocolo do ticket" },
    ],
    kanban: [
      { key: "{{kanban.column}}", description: "Coluna atual no Kanban" },
      { key: "{{kanban.tags}}", description: "Tags do lead" },
    ],
    company: [
      { key: "{{company.name}}", description: "Nome da empresa" },
      { key: "{{company.phone}}", description: "Telefone da empresa" },
    ],
    datetime: [
      { key: "{{datetime.now}}", description: "Data/hora atual" },
      { key: "{{datetime.date}}", description: "Data atual" },
      { key: "{{datetime.time}}", description: "Hora atual" },
      { key: "{{datetime.weekday}}", description: "Dia da semana" },
    ],
    custom: [
      { key: "{{custom.field_name}}", description: "Campo customizado (substituir field_name)" },
    ]
  };

  const tools = [
    { key: "#update_crm", description: "Atualizar campo no CRM/Kanban", example: "#update_crm(column, 'Qualificado')" },
    { key: "#send_file", description: "Enviar arquivo para o cliente", example: "#send_file('catalogo.pdf')" },
    { key: "#schedule_followup", description: "Agendar follow-up", example: "#schedule_followup('2 dias')" },
    { key: "#transfer_to", description: "Transferir para fila/agente", example: "#transfer_to('vendas')" },
    { key: "#add_tag", description: "Adicionar tag ao contato", example: "#add_tag('interessado')" },
    { key: "#create_task", description: "Criar tarefa no sistema", example: "#create_task('Ligar amanhã')" },
  ];

  const agents: Array<{ key: string; description: string }> = [];
  if (agentId) {
    const allAgents = await AIAgent.findAll({ where: { companyId } });
    for (const a of allAgents) {
      if (a.id !== Number(agentId)) {
        agents.push({
          key: `@${a.name.toLowerCase().replace(/\s+/g, "_")}`,
          description: `Chamar agente: ${a.name}`
        });
      }
    }
  }

  return res.status(200).json({
    ok: true,
    variables,
    tools,
    agents
  });
};
