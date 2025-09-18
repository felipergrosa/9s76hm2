import IAClientFactory from "../IAClientFactory";
import ResolveAIIntegrationService from "../ResolveAIIntegrationService";
import { FewShotPair } from "../IAClient";
import FindCompanySettingOneService from "../../CompaniesSettings/FindCompanySettingOneService";
import { search as ragSearch } from "../../RAG/RAGSearchService";
import GetIntegrationByTypeService from "../../QueueIntegrationServices/GetIntegrationByTypeService";

export type TransformMode = "translate" | "spellcheck" | "enhance";

export interface TransformTextParams {
  companyId: number;
  text: string;
  mode: TransformMode;
  targetLang?: string;
  integrationType?: "openai" | "gemini";
  queueId?: number | string | null;
  whatsappId?: number | string | null;
}

export default class ChatAssistantService {
  static buildFewShots(): FewShotPair[] {
    return [
      {
        user: 'Agradecer mensagem de aniversário em tom caloroso. Texto: "obrigado pela lembrança no meu dia"',
        assistant: 'Muito obrigado pela lembrança no meu dia! 🎉 Fiquei muito feliz com sua mensagem — é sempre especial receber esse carinho. 😊'
      },
      {
        user: 'Agradecer elogio do atendimento. Texto: "valeu pelo atendimento"',
        assistant: 'Que bom saber disso! 😊 Fico muito feliz que o atendimento tenha sido positivo. Se precisar de algo, estou por aqui pra ajudar!'
      }
    ];
  }

  static buildPrompts(params: TransformTextParams, cfg: any): { system: string; user: string; outLang?: string } {
    const { mode, text, targetLang } = params;

    const allowedVars: string[] = Array.isArray(cfg?.permittedVariables) ? cfg.permittedVariables : [];
    const allowedLine = allowedVars.length
      ? `Você PODE usar somente estes placeholders quando existirem no contexto: ${allowedVars.join(", ")}.`
      : "Se houver placeholders como {nome}, preserve-os; não invente novos.";
    const keepVars = `${allowedLine} Responda somente com o texto final, sem explicações.`;

    const tLang = targetLang || "pt-BR";
    let systemMsg = "";
    let userMsg = "";
    let outLang: string | undefined = undefined;

    if (mode === "translate") {
      systemMsg = `Você é um tradutor profissional.`;
      userMsg = `Traduza para ${tLang}. ${keepVars}\n\nTexto:\n\"\"\"${text}\"\"\"`;
    } else if (mode === "spellcheck") {
      systemMsg = `Você corrige ortografia e gramática em pt-BR sem mudar o sentido.`;
      userMsg = `${keepVars}\n\nTexto:\n\"\"\"${text}\"\"\"`;
    } else {
      const ed = cfg?.enhanceDefaults || {};
      const brandVoice = (cfg?.brandVoice || "").toString().trim();
      const tone = (ed.tone || "amigável").toString();
      const emojiLevel = (ed.emojiLevel || "medium").toString();
      const hashtagsPref = (ed.hashtags || "auto").toString();
      const customHashtags = (ed.customHashtags || "").toString().trim();
      const lengthPref = (ed.length || "medium").toString();
      const outLangCfg = (ed.language || "pt-BR").toString();
      outLang = outLangCfg;

      const lengthGuide = lengthPref === "short" ? "3-4 linhas curtas"
        : lengthPref === "long" ? "6-8 linhas curtas"
        : "4-6 linhas curtas";

      const emojiGuide = emojiLevel === "none" ? "evite emojis"
        : emojiLevel === "low" ? "use poucos emojis (0-2) de forma sutil"
        : emojiLevel === "high" ? "use mais emojis com parcimônia (até 6)" : "use alguns emojis (até 3)";

      const hashtagsGuide = hashtagsPref === "custom" ? `inclua ao final as hashtags: ${customHashtags || ""}`
        : "inclua 2-4 hashtags relevantes ao final";

      const voice = brandVoice ? `Voz da marca: ${brandVoice}.` : "";

      const style = `Escreva de forma natural, leve e próxima, evitando formalidade excessiva. Prefira voz ativa, frases curtas, fluxo conversacional e positividade. Se o contexto for comemorativo (ex.: aniversário), permita uma linha extra de celebração.`;

      systemMsg = `Você aprimora mensagens para WhatsApp (claras, naturais, sem SPAM). ${voice}`;
      userMsg = `Reescreva em ${outLangCfg} com TOM ${tone}. ${emojiGuide}. ${hashtagsGuide}. Tamanho: ${lengthGuide}. ${style} ${keepVars}\n\nTexto:\n\"\"\"${text}\n\"\"\"`;
    }

    return { system: systemMsg, user: userMsg, outLang };
  }

  static postProcessEnhance(out: string, cfg: any, mode: TransformMode): string {
    try {
      if (!out) return out || "";
      if (mode !== "enhance") return out;
      const ed = cfg?.enhanceDefaults || {};
      const hashtagsPref = (ed.hashtags || "auto").toString();
      const customHashtags = (ed.customHashtags || "").toString().trim();
      if (hashtagsPref === "custom" && customHashtags) {
        const normalized = customHashtags.replace(/,+/g, " ").trim();
        if (normalized && !out.toLowerCase().includes(normalized.split(/\s+/)[0]?.toLowerCase())) {
          const sep = out.endsWith("\n") ? "\n" : "\n\n";
          out = `${out}${sep}${normalized}`;
        }
      }
      return out;
    } catch {
      return out || "";
    }
  }

  static async runTransformText(params: TransformTextParams): Promise<string> {
    const { companyId, integrationType, queueId, whatsappId } = params;

    const resolved = await ResolveAIIntegrationService({
      companyId,
      queueId: queueId as any,
      whatsappId: whatsappId as any,
      preferProvider: integrationType as any
    });

    if (!resolved || !resolved.config?.apiKey) {
      throw new Error("Nenhuma integração de IA disponível. Configure em Integrações → Queue Integration.");
    }

    const cfg = resolved.config || {};
    const model: string = String(cfg.model || (resolved.provider === "gemini" ? "gemini-2.0-pro" : "gpt-4o-mini"));
    const temperature = typeof cfg.temperature === "number" ? cfg.temperature : 0.7;
    const top_p = typeof cfg.topP === "number" ? cfg.topP : 0.9;
    const presence_penalty = typeof cfg.presencePenalty === "number" ? cfg.presencePenalty : 0.0;
    const max_tokens = typeof cfg.maxTokens === "number" ? cfg.maxTokens : 400;

    let { system, user } = this.buildPrompts(params, cfg);

    // RAG: ler preferências a partir da integração 'knowledge'
    try {
      let ragEnabled = false;
      let ragTopK = 4;
      // 1) Ler da integração 'knowledge' (prioritário)
      try {
        const knowledge = await GetIntegrationByTypeService({ companyId, type: 'knowledge' });
        const j = (knowledge?.jsonContent || {}) as any;
        const ve = j?.ragEnabled;
        if (typeof ve === 'boolean') ragEnabled = ve;
        if (typeof ve === 'string') ragEnabled = ['enabled','true','on','1'].includes(ve.toLowerCase());
        const k = Number(j?.ragTopK);
        if (!isNaN(k) && k > 0) ragTopK = Math.min(20, Math.max(1, k));
      } catch {}

      // 2) Fallback para CompaniesSettings (legado)
      try {
        if (!ragEnabled) {
          const en = await FindCompanySettingOneService({ companyId, column: "ragEnabled" });
          const v2 = (en as any)?.[0]?.["ragEnabled"];
          ragEnabled = String(v2 || "").toLowerCase() === "enabled";
        }
      } catch {}
      try {
        if (!ragTopK) {
          const rk = await FindCompanySettingOneService({ companyId, column: "ragTopK" });
          const k2 = Number((rk as any)?.[0]?.["ragTopK"]);
          if (!isNaN(k2)) ragTopK = Math.min(20, Math.max(1, k2));
        }
      } catch {}

      if (ragEnabled) {
        const hits = await ragSearch({ companyId, query: params.text, k: ragTopK });
        if (Array.isArray(hits) && hits.length) {
          const context = hits.map((h, i) => `Fonte ${i + 1}:\n${h.content}`).join("\n\n");
          system = `${system}\n\nUse, se relevante, as fontes a seguir (não invente fatos):\n${context}`;
          try { console.log("[IA][rag][retrieve]", { companyId, hits: hits.length, k: ragTopK }); } catch {}
        }
      }
    } catch {}

    const client = IAClientFactory(resolved.provider, cfg.apiKey);
    const t0 = Date.now();
    const text = await client.chat({
      model,
      system,
      user,
      fewShots: this.buildFewShots(),
      temperature,
      top_p,
      presence_penalty,
      max_tokens,
    });
    const latency = Date.now() - t0;
    try {
      console.log("[IA][transformText]", {
        provider: resolved.provider,
        model,
        latencyMs: latency,
        companyId,
        queueId,
        whatsappId,
        mode: params.mode,
      });
    } catch {}

    return this.postProcessEnhance(text, cfg, params.mode);
  }
}
