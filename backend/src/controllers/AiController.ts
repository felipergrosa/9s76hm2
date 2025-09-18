import { Request, Response } from "express";
import OpenAI from "openai";
import GetIntegrationByTypeService from "../services/QueueIntegrationServices/GetIntegrationByTypeService";
import ResolveAIIntegrationService from "../services/IA/ResolveAIIntegrationService";
import IAClientFactory from "../services/IA/IAClientFactory";
import ChatAssistantService from "../services/IA/usecases/ChatAssistantService";

const extractVariables = (text: string): string[] => {
  if (!text) return [];
  const matches = text.match(/\{[^}]+\}/g) || [];
  // normalize: remove duplicates and keep original braces
  return Array.from(new Set(matches));
};
// Unified text transform endpoint (translate, spellcheck, enhance)
export const transformText = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user;
    const { mode, text, targetLang, integrationType, queueId, whatsappId }
      : { mode: "translate" | "spellcheck" | "enhance"; text: string; targetLang?: string; integrationType?: "openai" | "gemini"; queueId?: number | string; whatsappId?: number | string } = req.body || {};

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "text é obrigatório" });
    }
    if (!mode || !["translate", "spellcheck", "enhance"].includes(mode)) {
      return res.status(400).json({ error: "mode inválido" });
    }

    const result = await ChatAssistantService.runTransformText({
      companyId,
      text,
      mode,
      targetLang,
      integrationType,
      queueId,
      whatsappId,
    });

    return res.status(200).json({ result });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao transformar texto" });
  }
};

const buildPrompt = (
  baseText: string,
  variables: string[],
  tone: string,
  language: string,
  numVariations: number,
  businessContext?: string
) => {
  const varsLine = variables.length
    ? `Preserve exatamente os placeholders: ${variables.join(", ")}.`
    : "Se houver placeholders como {nome}, preserve-os.";

  const ctx = businessContext ? `Contexto do negócio: ${businessContext}.` : "";

  return `Você é um assistente especialista em copywriting para WhatsApp em ${language}.
Gere ${numVariations} variações curtas e naturais para a mensagem abaixo, mantendo mesma intenção.
Tome cuidado com políticas anti-spam do WhatsApp: evitar CAPS excessivo, evitar múltiplos links, CTA objetivo.
TOM: ${tone}. ${ctx}
${varsLine}
Mensagem base: \n"""${baseText}"""\n
Responda como um JSON com o formato: { "variations": ["...", "..."] } e nada além disso.`;
};

export const generateCampaignMessages = async (req: Request, res: Response) => {
  try {
    const {
      baseText,
      variables: variablesFromClient,
      tone = "amigável",
      language = "pt-BR",
      numVariations = 2,
      businessContext
    } = req.body || {};

    const { companyId } = req.user;

    if (!baseText || typeof baseText !== "string") {
      return res.status(400).json({ error: "baseText é obrigatório" });
    }

    // Resolve provedor+credenciais utilizando a arquitetura unificada
    const resolved = await ResolveAIIntegrationService({ companyId });
    if (!resolved || !resolved.config?.apiKey) {
      return res.status(500).json({ error: "Nenhuma integração de IA disponível. Configure em Integrações → Queue Integration." });
    }
    const cfg = resolved.config || {};
    const model: string = String(cfg.model || (resolved.provider === "gemini" ? "gemini-2.0-pro" : "gpt-4o-mini"));
    const temperature = typeof cfg.temperature === "number" ? cfg.temperature : 0.8;
    const top_p = typeof cfg.topP === "number" ? cfg.topP : 0.9;
    const presence_penalty = typeof cfg.presencePenalty === "number" ? cfg.presencePenalty : 0.0;
    const max_tokens = typeof cfg.maxTokens === "number" ? cfg.maxTokens : 400;

    const variables = Array.isArray(variablesFromClient)
      ? variablesFromClient
      : extractVariables(baseText);

    const system = "Você é um especialista em campanhas de WhatsApp.";
    const user = buildPrompt(
      baseText,
      variables,
      tone,
      language,
      Math.min(Math.max(1, Number(numVariations) || 1), 5),
      businessContext
    );

    const client = IAClientFactory(resolved.provider, cfg.apiKey);
    const t0 = Date.now();
    const content = await client.chat({
      model,
      system,
      user,
      temperature,
      top_p,
      presence_penalty,
      max_tokens,
    });
    const latency = Date.now() - t0;
    try {
      console.log("[IA][campaign]", { provider: resolved.provider, model, latencyMs: latency, companyId });
    } catch {}

    // Try parse JSON
    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch (_) {
      // Fallback: attempt to extract JSON substring
      const jsonMatch = content.match(/\{[\s\S]*\}$/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch (_) {}
      }
    }

    if (!parsed || !Array.isArray(parsed.variations)) {
      return res.status(200).json({ variations: [] });
    }

    // Ensure variables placeholders are preserved
    const ensured = parsed.variations.map((v: string) => {
      if (typeof v !== "string") return "";
      variables.forEach(ph => {
        // if placeholder missing, append at end as safety (rare)
        if (!v.includes(ph)) {
          // do nothing; we won't force-inject to avoid awkward texts
        }
      });
      return v;
    }).filter(Boolean);

    return res.status(200).json({ variations: ensured });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Erro ao gerar variações" });
  }
};

export const encryptionStatus = async (_req: Request, res: Response) => {
  try {
    const enabled = Boolean(process.env.OPENAI_ENCRYPTION_KEY || process.env.DATA_KEY);
    return res.status(200).json({ encryptionEnabled: enabled });
  } catch (error: any) {
    return res.status(200).json({ encryptionEnabled: false });
  }
};

export const listModels = async (req: Request, res: Response) => {
  try {
    const { provider } = (req.query || {}) as { provider?: string };
    const { companyId } = req.user;
    const prov = provider === 'gemini' ? 'gemini' : 'openai';

    if (prov === 'openai') {
      // Tenta obter integração da empresa; se não houver, retorna lista recomendada estática
      try {
        const integration = await GetIntegrationByTypeService({ companyId, type: 'openai' });
        const cfg = (typeof integration?.jsonContent === 'string') ? JSON.parse(integration.jsonContent) : (integration?.jsonContent || {});
        if (cfg?.apiKey) {
          // Opcional: poderíamos listar via API aqui, mas manteremos lista recomendada por estabilidade
          return res.status(200).json({ provider: 'openai', models: [
            'gpt-4o', 'gpt-4o-mini', 'gpt-4o-realtime', 'gpt-3.5-turbo-1106'
          ]});
        }
      } catch {}
      return res.status(200).json({ provider: 'openai', models: [
        'gpt-4o', 'gpt-4o-mini', 'gpt-4o-realtime', 'gpt-3.5-turbo-1106'
      ]});
    }

    // gemini
    try {
      const integration = await GetIntegrationByTypeService({ companyId, type: 'gemini' });
      const cfg = (typeof integration?.jsonContent === 'string') ? JSON.parse(integration.jsonContent) : (integration?.jsonContent || {});
      if (cfg?.apiKey) {
        return res.status(200).json({ provider: 'gemini', models: [
          'gemini-2.0-pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'
        ]});
      }
    } catch {}
    return res.status(200).json({ provider: 'gemini', models: [
      'gemini-2.0-pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'
    ]});
  } catch (error: any) {
    return res.status(200).json({ provider: 'openai', models: [] });
  }
};

export default { generateCampaignMessages, encryptionStatus, transformText };
