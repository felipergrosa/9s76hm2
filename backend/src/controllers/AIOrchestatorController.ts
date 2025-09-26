import { Request, Response } from "express";
import AIOrchestrator, { AIRequest, ModuleContext, AIMode } from "../services/IA/AIOrchestrator";

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
    const { providers } = req.body; // ["openai", "gemini"] ou vazio para todos

    const testProviders = providers || ["openai", "gemini"];
    const results: any = {};

    for (const provider of testProviders) {
      try {
        console.log(`[AIController] Testing provider: ${provider}`);
        
        const testResponse = await AIOrchestrator.processRequest({
          module: "general",
          mode: "chat",
          companyId,
          text: "Teste de conectividade",
          preferProvider: provider,
          maxTokens: 10,
          metadata: { test: true }
        });

        results[provider] = {
          success: testResponse.success,
          model: testResponse.model,
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
 * Endpoint para obter estatísticas básicas (placeholder)
 */
export const getStats = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user;
    
    // TODO: Implementar coleta de estatísticas do banco
    const stats = {
      companyId,
      totalRequests: 0,
      requestsByProvider: {},
      requestsByModule: {},
      averageProcessingTime: 0,
      successRate: 0,
      lastRequest: null,
      message: "Estatísticas serão implementadas na próxima fase"
    };

    return res.status(200).json(stats);

  } catch (error: any) {
    console.error("[AIController] Error getting stats:", error);
    return res.status(500).json({
      error: error?.message || "Erro ao obter estatísticas"
    });
  }
};
