import IAClientFactory from "../IAClientFactory";
import ResolveAIIntegrationService from "../ResolveAIIntegrationService";
import ResolvePresetConfigService, { ModuleType } from "../ResolvePresetConfigService";
import { FewShotPair } from "../IAClient";
import FindCompanySettingOneService from "../../CompaniesSettings/FindCompanySettingOneService";
import { search as ragSearch } from "../../RAG/RAGSearchService";
import { buildContext, formatContextForPrompt } from "../../RAG/RAGContextBuilder";
import GetIntegrationByTypeService from "../../QueueIntegrationServices/GetIntegrationByTypeService";
import AIOrchestrator from "../AIOrchestrator";

export type TransformMode = "translate" | "spellcheck" | "enhance" | "create";

export interface TransformTextParams {
  companyId: number;
  text: string;
  mode: TransformMode;
  targetLang?: string;
  integrationType?: "openai" | "gemini";
  queueId?: number | string | null;
  whatsappId?: number | string | null;
  module?: ModuleType; // Novo parâmetro para determinar o módulo
  assistantContext?: string; // Contexto do assistente (ticket, campaign, etc.)
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

    if (mode === "create") {
      // Modo CRIAR - gera texto do zero a partir de instrução
      systemMsg = `Você é um especialista em copywriting para WhatsApp. Cria mensagens claras, naturais e envolventes que geram engajamento sem parecer spam.`;
      userMsg = `Crie uma mensagem profissional em português brasileiro baseada nesta instrução:\n\n"${text}"\n\n${keepVars}\n\nDiretrizes:\n- Tom caloroso e profissional\n- Use emojis com moderação (2-3 no máximo)\n- Seja conciso (3-5 linhas)\n- Evite CAPS excessivo\n- Inclua call-to-action sutil se apropriado\n- Mantenha naturalidade conversacional`;
    } else if (mode === "translate") {
      systemMsg = `Você é um tradutor profissional.`;
      userMsg = `Traduza para ${tLang}. ${keepVars}\n\nTexto:\n\"\"\"${text}\"\"\"`;
    } else if (mode === "spellcheck") {
      systemMsg = `Você é um revisor especializado em português brasileiro. Corrige ortografia, gramática e pontuação mantendo o tom e intenção originais.`;
      userMsg = `Corrija este texto preservando seu estilo e significado. ${keepVars}\n\nTexto:\n\"\"\"${text}\"\"\"`;
    } else {
      // Usar configurações do preset se disponível, senão fallback para enhanceDefaults
      const ed = cfg?.enhanceDefaults || {};
      const brandVoice = (cfg?.brandVoice || "").toString().trim();
      const tone = (cfg?.tone || ed.tone || "amigável").toString();
      
      console.log(`[ChatAssistant] Configurações aplicadas:`, {
        hasSystemPrompt: !!(cfg?.systemPrompt && cfg.systemPrompt.trim()),
        tone: cfg?.tone,
        emotions: cfg?.emotions,
        hashtags: cfg?.hashtags,
        length: cfg?.length,
        language: cfg?.language
      });
      
      // Mapear configurações de emojis do preset
      let emojiLevel = (cfg?.emotions || ed.emojiLevel || "medium").toString().toLowerCase();
      if (emojiLevel === "baixo") emojiLevel = "low";
      else if (emojiLevel === "médio") emojiLevel = "medium";  
      else if (emojiLevel === "alto") emojiLevel = "high";
      
      // Mapear configurações de hashtags do preset
      let hashtagsPref = (cfg?.hashtags || ed.hashtags || "auto").toString().toLowerCase();
      if (hashtagsPref === "sem hashtags") hashtagsPref = "none";
      else if (hashtagsPref === "com hashtags") hashtagsPref = "auto";
      
      const customHashtags = (ed.customHashtags || "").toString().trim();
      
      // Mapear configurações de tamanho do preset
      let lengthPref = (cfg?.length || ed.length || "medium").toString().toLowerCase();
      if (lengthPref === "curto") lengthPref = "short";
      else if (lengthPref === "médio") lengthPref = "medium";
      else if (lengthPref === "longo") lengthPref = "long";
      
      const outLangCfg = (cfg?.language || ed.language || "pt-BR").toString();
      outLang = outLangCfg;

      const lengthGuide = lengthPref === "short" ? "3-4 linhas curtas"
        : lengthPref === "long" ? "6-8 linhas curtas"
        : "4-6 linhas curtas";

      const emojiGuide = emojiLevel === "none" ? "evite emojis"
        : emojiLevel === "low" ? "use poucos emojis (0-2) de forma sutil"
        : emojiLevel === "high" ? "use mais emojis com parcimônia (até 6)" : "use alguns emojis (até 3)";

      const hashtagsGuide = hashtagsPref === "none" ? "não inclua hashtags"
        : hashtagsPref === "custom" ? `inclua ao final as hashtags: ${customHashtags || ""}`
        : "inclua 2-4 hashtags relevantes ao final";

      const voice = brandVoice ? `Voz da marca: ${brandVoice}.` : "";

      const style = `IMPORTANTE - Faça mudanças SIGNIFICATIVAS:\n- Reestruture frases para maior clareza e impacto\n- Adicione elementos persuasivos sutis\n- Melhore o fluxo e ritmo da mensagem\n- Torne mais conversacional e humano\n- Elimine redundâncias e palavras vazias\n- Fortaleça o call-to-action se houver\n- Mantenha tom natural, evitando formalidade excessiva\n- Use voz ativa e frases curtas\n- Se contexto comemorativo, celebre com entusiasmo`;

      // Usar systemPrompt do preset se disponível, senão usar padrão
      if (cfg?.systemPrompt && cfg.systemPrompt.trim()) {
        systemMsg = cfg.systemPrompt;
        userMsg = `${keepVars}\n\nTexto:\n\"\"\"${text}\"\"\"`;
      } else {
        systemMsg = `Você é um especialista em copywriting para WhatsApp. Seu objetivo é TRANSFORMAR mensagens comuns em comunicações impactantes e envolventes. ${voice}`;
        userMsg = `APRIMORE SIGNIFICATIVAMENTE esta mensagem em ${outLangCfg}:\n\nTOM: ${tone}\nEMOJIS: ${emojiGuide}\nHASHTAGS: ${hashtagsGuide}\nTAMANHO: ${lengthGuide}\n\n${style}\n\n${keepVars}\n\nMensagem original:\n\"\"\"${text}\n\"\"\"\n\nSua versão aprimorada:`;
      }
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
    console.log("[ChatAssistantService] Using AIOrchestrator for transform text");
    
    // Migração para AIOrchestrator com fallback para método legado
    try {
      // Determina se deve usar RAG baseado nas configurações existentes
      let useRAG = false;
      let ragTopK = 4;
      
      try {
        const knowledge = await GetIntegrationByTypeService({ companyId: params.companyId, type: 'knowledge' });
        const j = (knowledge?.jsonContent || {}) as any;
        const ve = j?.ragEnabled;
        if (typeof ve === 'boolean') useRAG = ve;
        if (typeof ve === 'string') useRAG = ['enabled','true','on','1'].includes(ve.toLowerCase());
        const k = Number(j?.ragTopK);
        if (!isNaN(k) && k > 0) ragTopK = Math.min(20, Math.max(1, k));
      } catch {}

      // Fallback para CompaniesSettings
      if (!useRAG) {
        try {
          const en = await FindCompanySettingOneService({ companyId: params.companyId, column: "ragEnabled" });
          const v2 = (en as any)?.[0]?.["ragEnabled"];
          useRAG = String(v2 || "").toLowerCase() === "enabled";
        } catch {}
      }

      // Determina o módulo baseado no contexto antes de chamar o AIOrchestrator
      let moduleType: ModuleType = "general";
      
      if (params.module) {
        moduleType = params.module;
      } else if (params.assistantContext) {
        switch (params.assistantContext.toLowerCase()) {
          case "ticket":
            moduleType = "ticket";
            break;
          case "campaign":
            moduleType = "campaign";
            break;
          case "prompt":
            moduleType = "prompt";
            break;
          default:
            moduleType = "general";
        }
      }

      console.log(`[ChatAssistantService] Módulo determinado: ${moduleType} (context: ${params.assistantContext})`);

      // Usa AIOrchestrator com configurações preservadas
      const result = await AIOrchestrator.transformText({
        companyId: params.companyId,
        text: params.text,
        mode: params.mode,
        targetLang: params.targetLang,
        integrationType: params.integrationType,
        queueId: params.queueId,
        whatsappId: params.whatsappId,
        module: moduleType as "general" | "campaign" | "ticket" | "prompt" // ← Passa o módulo correto
      });

      return result;

    } catch (orchestratorError: any) {
      console.warn("[ChatAssistantService] AIOrchestrator failed, using legacy method:", orchestratorError.message);
      
      // Fallback para método legado em caso de erro
      return await this.runTransformTextLegacy(params);
    }
  }

  /**
   * Método legado preservado como fallback
   */
  private static async runTransformTextLegacy(params: TransformTextParams): Promise<string> {
    const { companyId, integrationType, queueId, whatsappId, module, assistantContext } = params;

    // Determina o módulo baseado no contexto
    let moduleType: ModuleType = "general";
    if (module) {
      moduleType = module;
    } else if (assistantContext) {
      // Mapeia contexto para módulo
      switch (assistantContext) {
        case "ticket":
          moduleType = "ticket";
          break;
        case "campaign":
          moduleType = "campaign";
          break;
        case "prompt":
          moduleType = "prompt";
          break;
        default:
          moduleType = "general";
      }
    }

    console.log(`[ChatAssistant] Resolvendo configuração para módulo: ${moduleType}`);

    // Tenta usar a nova lógica de preset primeiro
    let resolved = null;
    try {
      resolved = await ResolvePresetConfigService({
        companyId,
        module: moduleType,
        preferProvider: integrationType as any
      });
      
      if (resolved) {
        console.log(`[ChatAssistant] Usando configuração ${resolved.source}:`, {
          provider: resolved.provider,
          hasPreset: !!resolved.preset
        });
      }
    } catch (error) {
      console.warn(`[ChatAssistant] Erro ao resolver preset config:`, error.message);
    }

    // Fallback para método antigo se não encontrou configuração
    if (!resolved || !resolved.config?.apiKey) {
      console.log(`[ChatAssistant] Usando fallback para método antigo`);
      const legacyResolved = await ResolveAIIntegrationService({
        companyId,
        queueId: queueId as any,
        whatsappId: whatsappId as any,
        preferProvider: integrationType as any
      });

      if (!legacyResolved || !legacyResolved.config?.apiKey) {
        throw new Error("Nenhuma integração de IA disponível. Configure em Integrações → Queue Integration.");
      }
      
      resolved = {
        provider: legacyResolved.provider,
        config: legacyResolved.config,
        source: "global" as const
      };
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
        const hits = await ragSearch({ 
          companyId, 
          query: params.text, 
          k: ragTopK,
          hybrid: true,  // Busca híbrida ativada
          rerank: true   // Reranking ativado
        });
        if (Array.isArray(hits) && hits.length) {
          // Usa contexto otimizado (remove duplicatas, resume se grande)
          const { context, stats } = await buildContext(companyId, hits, {
            maxTotalChars: 3000,
            maxChunks: ragTopK,
            summarizeIfOversized: true
          });
          
          if (context) {
            const formattedContext = formatContextForPrompt(context, params.text);
            system = `${system}\n\n${formattedContext}`;
            console.log("[IA][rag][retrieve]", { 
              companyId, 
              hits: hits.length, 
              k: ragTopK,
              contextChars: stats.totalChars,
              duplicatesRemoved: stats.duplicatesRemoved,
              wasSummarized: stats.wasSummarized
            });
          }
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
      console.log("[IA][transformText][legacy]", {
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
