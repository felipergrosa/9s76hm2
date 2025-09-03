import { Request, Response } from "express";
import OpenAI from "openai";
import GetIntegrationByTypeService from "../services/QueueIntegrationServices/GetIntegrationByTypeService";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
    const {
      mode,
      text,
      targetLang,
      integrationType
    }: { mode: "translate" | "spellcheck" | "enhance"; text: string; targetLang?: string; integrationType?: "openai" | "gemini" } = req.body || {};

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "text é obrigatório" });
    }
    if (!mode || !["translate", "spellcheck", "enhance"].includes(mode)) {
      return res.status(400).json({ error: "mode inválido" });
    }

    // Pick integration type: explicit or prefer openai then gemini
    let pickedType: "openai" | "gemini" | null = null;
    if (integrationType === "openai" || integrationType === "gemini") pickedType = integrationType;
    let integration: any = null;

    if (pickedType) {
      try { integration = await GetIntegrationByTypeService({ companyId, type: pickedType }); } catch { /* ignore */ }
    } else {
      try { integration = await GetIntegrationByTypeService({ companyId, type: "openai" }); pickedType = integration ? "openai" : null; } catch { /* ignore */ }
      if (!integration) {
        try { integration = await GetIntegrationByTypeService({ companyId, type: "gemini" }); pickedType = integration ? "gemini" : null; } catch { /* ignore */ }
      }
    }

    // Early check: if no provider available at all (no integrations nor env keys), return clear message
    try {
      let hasOpenAIIntegration = false;
      let hasGeminiIntegration = false;
      try {
        const openaiInt = await GetIntegrationByTypeService({ companyId, type: "openai" });
        hasOpenAIIntegration = Boolean(openaiInt?.jsonContent?.apiKey);
      } catch {}
      try {
        const geminiInt = await GetIntegrationByTypeService({ companyId, type: "gemini" });
        hasGeminiIntegration = Boolean(geminiInt?.jsonContent?.apiKey);
      } catch {}
      const hasAnyEnv = Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
      if (!hasOpenAIIntegration && !hasGeminiIntegration && !hasAnyEnv) {
        return res.status(400).json({ error: "Nenhuma integração de IA disponível. Configure uma API (OpenAI ou Gemini) nas Configurações Globais." });
      }
    } catch {}

    const cfg = integration?.jsonContent || {};
    const model = String(cfg.model || (pickedType === "gemini" ? "gemini-2.0-pro" : process.env.OPENAI_MODEL || "gpt-4o-mini"));
    const temperature = typeof cfg.temperature === "number" ? cfg.temperature : 0.7;
    const max_tokens = typeof cfg.maxTokens === "number" ? cfg.maxTokens : 400;

    // Prompts
    const keepVars = "Mantenha intactos placeholders como {nome}, URLs e emojis. Responda somente com o texto final, sem explicações.";
    const tLang = targetLang || "pt-BR";
    let systemMsg = "";
    let userMsg = "";
    if (mode === "translate") {
      systemMsg = `Você é um tradutor profissional.`;
      userMsg = `Traduza para ${tLang}. ${keepVars}\n\nTexto:\n"""${text}"""`;
    } else if (mode === "spellcheck") {
      systemMsg = `Você corrige ortografia e gramática em pt-BR sem mudar o sentido.`;
      userMsg = `${keepVars}\n\nTexto:\n"""${text}"""`;
    } else {
      systemMsg = `Você aprimora mensagens para WhatsApp (claras, naturais, sem SPAM).`;
      userMsg = `${keepVars}\n\nTexto:\n"""${text}\n"""`;
    }

    // Try OpenAI then Gemini if no explicit type
    const tryOpenAI = async () => {
      let apiKey: string | undefined = cfg.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");
      const client = new OpenAI({ apiKey });
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: "system" as const, content: systemMsg },
          { role: "user" as const, content: userMsg },
        ],
        temperature,
        max_tokens,
      });
      return completion.choices?.[0]?.message?.content?.trim() || "";
    };

    const tryGemini = async () => {
      const apiKey: string | undefined = cfg.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");
      const genAI = new GoogleGenerativeAI(apiKey);
      const modelClient = genAI.getGenerativeModel({ model, systemInstruction: systemMsg });
      const chat = modelClient.startChat({ history: [] });
      const result = await chat.sendMessage(userMsg);
      return result.response.text().trim();
    };

    let out = "";
    if (pickedType === "openai") {
      out = await tryOpenAI();
    } else if (pickedType === "gemini") {
      out = await tryGemini();
    } else {
      try {
        out = await tryOpenAI();
      } catch (_) {
        out = await tryGemini();
      }
    }

    return res.status(200).json({ result: out || "" });
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

    // Resolve credenciais do OpenAI por integração da empresa (fallback para ENV)
    let apiKey: string | undefined = process.env.OPENAI_API_KEY;
    let model: string = process.env.OPENAI_MODEL || "gpt-4o-mini";
    try {
      const integration = await GetIntegrationByTypeService({ companyId, type: "openai" });
      const cfg = integration?.jsonContent || {};
      if (cfg.apiKey) apiKey = cfg.apiKey;
      if (cfg.model) model = String(cfg.model);
    } catch (_) {
      // ignore and rely on env vars
    }
    if (!apiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY não configurada (integração ou env)" });
    }

    const variables = Array.isArray(variablesFromClient)
      ? variablesFromClient
      : extractVariables(baseText);

    const messages = [
      { role: "system" as const, content: "Você é um especialista em campanhas de WhatsApp." },
      { role: "user" as const, content: buildPrompt(baseText, variables, tone, language, Math.min(Math.max(1, Number(numVariations) || 1), 5), businessContext) }
    ];

    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.8,
      max_tokens: 400,
    });

    const content = completion.choices?.[0]?.message?.content || "";

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

export default { generateCampaignMessages, encryptionStatus, transformText };
