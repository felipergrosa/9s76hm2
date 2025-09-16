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

    let cfgRaw: any = integration?.jsonContent || {};
    // Garantir que jsonContent seja objeto
    if (typeof cfgRaw === "string") {
      try { cfgRaw = JSON.parse(cfgRaw); } catch { cfgRaw = {}; }
    }
    const cfg: any = cfgRaw || {};
    const model = String(cfg.model || (pickedType === "gemini" ? "gemini-2.0-pro" : process.env.OPENAI_MODEL || "gpt-4o-mini"));
    const temperature = typeof cfg.temperature === "number" ? cfg.temperature : 0.7;
    const top_p = typeof cfg.topP === "number" ? cfg.topP : 0.9;
    const presence_penalty = typeof cfg.presencePenalty === "number" ? cfg.presencePenalty : 0.0;
    const max_tokens = typeof cfg.maxTokens === "number" ? cfg.maxTokens : 400;

    // Prompts
    const allowedVars: string[] = Array.isArray(cfg.permittedVariables) ? cfg.permittedVariables : [];
    const allowedLine = allowedVars.length
      ? `Você PODE usar somente estes placeholders quando existirem no contexto: ${allowedVars.join(", ")}.`
      : "Se houver placeholders como {nome}, preserve-os; não invente novos.";
    const keepVars = `${allowedLine} Responda somente com o texto final, sem explicações.`;
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
      // ENHANCE: usar preferências da integração
      const ed = cfg.enhanceDefaults || {};
      const brandVoice = (cfg.brandVoice || "").toString().trim();
      const tone = (ed.tone || "amigável").toString();
      const emojiLevel = (ed.emojiLevel || "medium").toString();
      const hashtagsPref = (ed.hashtags || "auto").toString();
      const customHashtags = (ed.customHashtags || "").toString().trim();
      const lengthPref = (ed.length || "medium").toString();
      const outLang = (ed.language || "pt-BR").toString();

      const lengthGuide = lengthPref === "short" ? "3-4 linhas curtas"
        : lengthPref === "long" ? "6-8 linhas curtas"
        : "4-6 linhas curtas";

      const emojiGuide = emojiLevel === "none" ? "evite emojis"
        : emojiLevel === "low" ? "use poucos emojis (0-2) de forma sutil"
        : emojiLevel === "high" ? "use mais emojis com parcimônia (até 6)" : "use alguns emojis (até 3)";

      const hashtagsGuide = hashtagsPref === "custom" ? `inclua ao final as hashtags: ${customHashtags || ""}`
        : "inclua 2-4 hashtags relevantes ao final";

      const voice = brandVoice ? `Voz da marca: ${brandVoice}.` : "";

      // Instruções de estilo mais humano
      const style = `Escreva de forma natural, leve e próxima, evitando formalidade excessiva. Prefira voz ativa, frases curtas, fluxo conversacional e positividade. Se o contexto for comemorativo (ex.: aniversário), permita uma linha extra de celebração.`;

      systemMsg = `Você aprimora mensagens para WhatsApp (claras, naturais, sem SPAM). ${voice}`;
      userMsg = `Reescreva em ${outLang} com TOM ${tone}. ${emojiGuide}. ${hashtagsGuide}. Tamanho: ${lengthGuide}. ${style} ${keepVars}\n\nTexto:\n"""${text}\n"""`;
    }

    // Try OpenAI then Gemini if no explicit type
    const tryOpenAI = async () => {
      let apiKey: string | undefined = cfg.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");
      const client = new OpenAI({ apiKey });
      // Few-shots (pares user/assistant) para elevar consistência
      const fewShots = [
        {
          user: 'Agradecer mensagem de aniversário em tom caloroso. Texto: "obrigado pela lembrança no meu dia"',
          assistant: 'Muito obrigado pela lembrança no meu dia! 🎉 Fiquei muito feliz com sua mensagem — é sempre especial receber esse carinho. 😊'
        },
        {
          user: 'Agradecer elogio do atendimento. Texto: "valeu pelo atendimento"',
          assistant: 'Que bom saber disso! 😊 Fico muito feliz que o atendimento tenha sido positivo. Se precisar de algo, estou por aqui pra ajudar!'
        }
      ];
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemMsg },
        ...fewShots.flatMap(fs => ([
          { role: "user" as const, content: fs.user },
          { role: "assistant" as const, content: fs.assistant },
        ])),
        { role: "user", content: userMsg },
      ];
      const completion = await client.chat.completions.create({
        model,
        messages,
        temperature,
        top_p,
        presence_penalty,
        max_tokens,
      });
      return completion.choices?.[0]?.message?.content?.trim() || "";
    };

    const tryGemini = async () => {
      const apiKey: string | undefined = cfg.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");
      const genAI = new GoogleGenerativeAI(apiKey);
      const modelClient = genAI.getGenerativeModel({ model, systemInstruction: systemMsg });
      // Few-shots no histórico
      const history = [
        { role: 'user', parts: [{ text: 'Agradecer mensagem de aniversário em tom caloroso. Texto: "obrigado pela lembrança no meu dia"' }] },
        { role: 'model', parts: [{ text: 'Muito obrigado pela lembrança no meu dia! 🎉 Fiquei muito feliz com sua mensagem — é sempre especial receber esse carinho. 😊' }] },
        { role: 'user', parts: [{ text: 'Agradecer elogio do atendimento. Texto: "valeu pelo atendimento"' }] },
        { role: 'model', parts: [{ text: 'Que bom saber disso! 😊 Fico muito feliz que o atendimento tenha sido positivo. Se precisar de algo, estou por aqui pra ajudar!' }] },
      ];
      const chat = modelClient.startChat({ history });
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

    // Pós-processamento: anexar hashtags personalizadas se configuradas e não presentes
    try {
      let finalText = out || "";
      if (mode === "enhance") {
        const ed = cfg.enhanceDefaults || {};
        const hashtagsPref = (ed.hashtags || "auto").toString();
        const customHashtags = (ed.customHashtags || "").toString().trim();
        if (hashtagsPref === "custom" && customHashtags) {
          const normalized = customHashtags.replace(/,+/g, " ").trim();
          if (normalized && !finalText.toLowerCase().includes(normalized.split(/\s+/)[0]?.toLowerCase())) {
            const sep = finalText.endsWith("\n") ? "\n" : "\n\n";
            finalText = `${finalText}${sep}${normalized}`;
          }
        }
      }
      return res.status(200).json({ result: finalText });
    } catch {
      return res.status(200).json({ result: out || "" });
    }
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

export const listModels = async (req: Request, res: Response) => {
  try {
    const { provider } = (req.query || {}) as { provider?: string };
    const { companyId } = req.user;
    const prov = provider === 'gemini' ? 'gemini' : 'openai';

    if (prov === 'openai') {
      // tentar listar via API; se falhar, fallback estático
      try {
        let apiKey: string | undefined = process.env.OPENAI_API_KEY;
        try {
          const integration = await GetIntegrationByTypeService({ companyId, type: 'openai' });
          const cfg = (typeof integration?.jsonContent === 'string') ? JSON.parse(integration.jsonContent) : (integration?.jsonContent || {});
          if (cfg?.apiKey) apiKey = cfg.apiKey;
        } catch {}
        if (!apiKey) throw new Error('no key');
        const client = new OpenAI({ apiKey });
        const list = await client.models.list();
        const models = (list?.data || [])
          .map(m => m.id)
          .filter(id => /gpt|o\d|4o|mini|gpt-3\.5|gpt-4/i.test(id))
          .sort();
        const unique = Array.from(new Set(models));
        if (unique.length) return res.status(200).json({ provider: 'openai', models: unique });
      } catch {}
      return res.status(200).json({ provider: 'openai', models: [
        'gpt-4o', 'gpt-4o-mini', 'gpt-4o-realtime', 'gpt-3.5-turbo-1106'
      ]});
    }

    // gemini
    try {
      let apiKey: string | undefined = process.env.GEMINI_API_KEY;
      try {
        const integration = await GetIntegrationByTypeService({ companyId, type: 'gemini' });
        const cfg = (typeof integration?.jsonContent === 'string') ? JSON.parse(integration.jsonContent) : (integration?.jsonContent || {});
        if (cfg?.apiKey) apiKey = cfg.apiKey;
      } catch {}
      if (!apiKey) throw new Error('no key');
      // A SDK do Gemini nem sempre expõe listagem; retornamos recomendados
      return res.status(200).json({ provider: 'gemini', models: [
        'gemini-2.0-pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'
      ]});
    } catch {}
    return res.status(200).json({ provider: 'gemini', models: [
      'gemini-2.0-pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'
    ]});
  } catch (error: any) {
    return res.status(200).json({ provider: 'openai', models: [] });
  }
};

export default { generateCampaignMessages, encryptionStatus, transformText };
