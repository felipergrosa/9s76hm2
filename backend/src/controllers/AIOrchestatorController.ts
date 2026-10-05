import { Request, Response } from "express";
import AIOrchestrator, { AIRequest, ModuleContext, AIMode } from "../services/IA/AIOrchestrator";
import { getAIAnalytics } from "../services/IA/AIAnalyticsService";
import GetIntegrationByTypeService from "../services/QueueIntegrationServices/GetIntegrationByTypeService";
import sanitizeProviderBaseURL, { AI_PROVIDER_DEFAULT_BASE_URL } from "../utils/aiProviderBaseUrl";

/**
 * Controller para o AIOrchestrator - endpoint unificado para IA
 */
export const processAIRequest = async (req: Request, res: Response) => {
  try {
    const { companyId, id: userId } = req.user;
    const {
      module,
      mode,
      text,
      systemPrompt,
      targetLang,
      queueId,
      whatsappId,
      preferProvider,
      temperature,
      maxTokens,
      model,
      useRAG,
      ragQuery,
      ragFilters,
      metadata
    } = req.body;

    // Validações básicas
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: "Campo 'text' é obrigatório" });
    }

    if (!module || !["campaign", "ticket", "prompt", "general"].includes(module)) {
      return res.status(400).json({ error: "Campo 'module' inválido" });
    }

    if (!mode || !["enhance", "translate", "spellcheck", "chat", "rag"].includes(mode)) {
      return res.status(400).json({ error: "Campo 'mode' inválido" });
    }

    // Monta requisição para o orquestrador
    const aiRequest: AIRequest = {
      module: module as ModuleContext,
      mode: mode as AIMode,
      companyId,
      userId: userId ? Number(userId) : undefined,
      text,
      systemPrompt,
      targetLang,
      queueId: queueId ? Number(queueId) : undefined,
      whatsappId: whatsappId ? Number(whatsappId) : undefined,
      preferProvider,
      temperature,
      maxTokens,
      model,
      useRAG: Boolean(useRAG),
      ragQuery,
      ragFilters,
      metadata
    };

    console.log(`[AIController] Processing request for company ${companyId}`, {
      module,
      mode,
      textLength: text.length,
      useRAG: Boolean(useRAG)
    });

    // Processa via orquestrador
    const response = await AIOrchestrator.processRequest(aiRequest);

    if (!response.success) {
      return res.status(500).json({
        error: response.error || "Erro no processamento IA",
        requestId: response.requestId
      });
    }

    // Retorna resposta completa
    return res.status(200).json({
      success: true,
      result: response.result,
      metadata: {
        provider: response.provider,
        model: response.model,
        processingTime: response.processingTime,
        ragUsed: response.ragUsed,
        ragResultsCount: response.ragResults?.length || 0,
        requestId: response.requestId,
        timestamp: response.timestamp
      }
    });

  } catch (error: any) {
    console.error("[AIController] Error processing request:", error);
    return res.status(500).json({
      error: error?.message || "Erro interno do servidor",
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
};

/**
 * Endpoint de compatibilidade com ChatAssistantService
 */
export const transformText = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user;
    const {
      text,
      mode,
      targetLang,
      integrationType,
      queueId,
      whatsappId
    } = req.body;

    // Validações
    if (!text || !mode) {
      return res.status(400).json({ error: "Campos 'text' e 'mode' são obrigatórios" });
    }

    if (!["translate", "spellcheck", "enhance"].includes(mode)) {
      return res.status(400).json({ error: "Mode inválido" });
    }

    console.log(`[AIController] Transform text request`, {
      companyId,
      mode,
      textLength: text.length,
      integrationType
    });

    // Usa método de compatibilidade do orquestrador
    const result = await AIOrchestrator.transformText({
      companyId,
      text,
      mode,
      targetLang,
      integrationType,
      queueId,
      whatsappId
    });

    return res.status(200).json({ result });

  } catch (error: any) {
    console.error("[AIController] Error in transformText:", error);
    return res.status(500).json({
      error: error?.message || "Erro na transformação de texto"
    });
  }
};

/**
 * Endpoint para testar conectividade dos provedores
 */
export const testProviders = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user;
    // providers: ["openai","gemini","deepseek","grok"] ou vazio para todos.
    // configs[provider] (opcional): { apiKey, model, baseURL } digitados no
    // formulário — permite testar a chave ANTES de salvar a integração.
    const { providers, configs } = req.body;

    const SUPPORTED = ["openai", "gemini", "deepseek", "grok"];
    const testProviders = (Array.isArray(providers) && providers.length ? providers : ["openai", "gemini"])
      .filter((p: string) => SUPPORTED.includes(p));
    const results: any = {};

    for (const provider of testProviders) {
      try {
        console.log(`[AIController] Testing provider: ${provider}`);

        // Config salva + overrides do formulário. apiKey mascarada
        // ("****" / vazia) não sobrescreve a persistida.
        const saved = await GetIntegrationByTypeService({ companyId, type: provider });
        const savedCfg = saved?.jsonContent || {};
        const overrides = configs?.[provider] || {};
        const overrideKey =
          typeof overrides.apiKey === "string" && overrides.apiKey.trim() && !overrides.apiKey.includes("*")
            ? overrides.apiKey.trim()
            : undefined;

        const forcedConfig = {
          ...savedCfg,
          apiKey: overrideKey || savedCfg.apiKey,
          model: overrides.model || savedCfg.model,
          baseURL: sanitizeProviderBaseURL(
            overrides.baseURL || savedCfg.baseURL,
            AI_PROVIDER_DEFAULT_BASE_URL[provider] || savedCfg.baseURL
          )
        };

        if (!forcedConfig.apiKey) {
          results[provider] = {
            success: false,
            error: "Integração não configurada — informe e salve uma API key para este provedor."
          };
          continue;
        }

        const testResponse = await AIOrchestrator.processRequest({
          module: "general",
          mode: "chat",
          companyId,
          text: "Teste de conectividade. Responda apenas: OK",
          preferProvider: provider,
          strictProvider: true,
          forcedConfig,
          model: forcedConfig.model,
          maxTokens: 10,
          metadata: { test: true }
        });

        results[provider] = {
          success: testResponse.success,
          model: testResponse.model,
          provider: testResponse.provider,
          processingTime: testResponse.processingTime,
          error: testResponse.error
        };

      } catch (error: any) {
        results[provider] = {
          success: false,
          error: error?.message || "Erro desconhecido"
        };
      }
    }

    return res.status(200).json({
      success: true,
      results,
      timestamp: new Date()
    });

  } catch (error: any) {
    console.error("[AIController] Error testing providers:", error);
    return res.status(500).json({
      error: error?.message || "Erro no teste de provedores"
    });
  }
};

/**
 */
export const getStats = async (req: Request, res: Response) => {
  try {
    const {companyId } = req.user;
    const { days } = req.query;

    const windowDays = typeof days === "string" ? Number(days) : undefined;
    if (windowDays !== undefined && (Number.isNaN(windowDays) || windowDays <= 0)) {
      return res.status(400).json({ error: "Parâmetro 'days' deve ser um número positivo." });
    }

    const analytics = await getAIAnalytics(companyId, { days: windowDays });

    return res.status(200).json({
      companyId,
      ...analytics
    });

  } catch (error: any) {
    console.error("[AIController] Error getting stats:", error);
    return res.status(500).json({
      error: error?.message || "Erro ao obter estatísticas"
    });
  }
};
