import IAClientFactory from "./IAClientFactory";
import ResolveAIIntegrationService, { Provider } from "./ResolveAIIntegrationService";
import { IAClient, ChatRequest, ChatWithHistoryRequest } from "./IAClient";
import { search as ragSearch } from "../RAG/RAGSearchService";

export type ModuleContext = "campaign" | "ticket" | "prompt" | "general";
export type AIMode = "enhance" | "translate" | "spellcheck" | "chat" | "rag";

export interface AIRequest {
  // Contexto da requisição
  module: ModuleContext;
  mode: AIMode;
  companyId: number;
  userId?: number;
  
  // Parâmetros de resolução de provedor
  queueId?: number | string | null;
  whatsappId?: number | string | null;
  preferProvider?: Provider | null;
  
  // Conteúdo da requisição
  text: string;
  systemPrompt?: string;
  targetLang?: string;
  
  // Configurações específicas
  temperature?: number;
  maxTokens?: number;
  model?: string;
  
  // Contexto RAG
  useRAG?: boolean;
  ragQuery?: string;
  ragFilters?: {
    tags?: string[];
    documentId?: number;
    k?: number;
  };
  
  // Metadados para auditoria
  metadata?: {
    targetField?: string;
    assistantContext?: string;
    presetUsed?: string;
    [key: string]: any;
  };
}

export interface AIResponse {
  success: boolean;
  result?: string;
  error?: string;
  
  // Metadados da resposta
  provider: Provider;
  model: string;
  tokensUsed?: number;
  processingTime: number;
  
  // Contexto RAG (se usado)
  ragResults?: any[];
  ragUsed: boolean;
  
  // Auditoria
  requestId: string;
  timestamp: Date;
}

export interface AIFallbackConfig {
  maxRetries: number;
  retryDelay: number;
  fallbackProviders: Provider[];
}

export default class AIOrchestrator {
  private static defaultFallbackConfig: AIFallbackConfig = {
    maxRetries: 2,
    retryDelay: 1000,
    fallbackProviders: ["openai", "gemini"]
  };

  /**
   * Método principal - processa requisições IA com fallback automático
   */
  static async processRequest(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    try {
      console.log(`[AIOrchestrator] Processing request ${requestId}`, {
        module: request.module,
        mode: request.mode,
        companyId: request.companyId
      });

      // 1. Enriquecer contexto com RAG (se solicitado)
      let enrichedText = request.text;
      let ragResults: any[] = [];
      let ragUsed = false;

      if (request.useRAG && request.ragQuery) {
        try {
          const ragResponse = await this.enrichWithRAG(request);
          enrichedText = ragResponse.enrichedText;
          ragResults = ragResponse.results;
          ragUsed = true;
        } catch (ragError) {
          console.warn(`[AIOrchestrator] RAG enrichment failed:`, ragError);
          // Continua sem RAG em caso de erro
        }
      }

      // 2. Processar com fallback automático
      const response = await this.processWithFallback({
        ...request,
        text: enrichedText
      }, requestId);

      // 3. Adicionar metadados RAG
      response.ragResults = ragResults;
      response.ragUsed = ragUsed;
      response.processingTime = Date.now() - startTime;
      response.requestId = requestId;
      response.timestamp = new Date();

      // 4. Log da requisição (básico por enquanto)
      await this.logRequest(request, response);

      return response;

    } catch (error: any) {
      console.error(`[AIOrchestrator] Request ${requestId} failed:`, error);
      
      return {
        success: false,
        error: error?.message || "Erro interno do orquestrador IA",
        provider: "none" as Provider,
        model: "unknown",
        processingTime: Date.now() - startTime,
        ragUsed: false,
        requestId,
        timestamp: new Date()
      };
    }
  }

  /**
   * Processa requisição com fallback automático entre provedores
   */
  private static async processWithFallback(
    request: AIRequest, 
    requestId: string
  ): Promise<AIResponse> {
    const config = this.defaultFallbackConfig;
    let lastError: any = null;

    // Tenta resolver provedor preferido primeiro
    const primaryProvider = await this.resolveProvider(request);
    if (primaryProvider) {
      try {
        return await this.executeRequest(request, primaryProvider, requestId);
      } catch (error) {
        console.warn(`[AIOrchestrator] Primary provider ${primaryProvider.provider} failed:`, error);
        lastError = error;
      }
    }

    // Fallback para outros provedores
    for (const fallbackProvider of config.fallbackProviders) {
      if (fallbackProvider === primaryProvider?.provider) continue;

      try {
        console.log(`[AIOrchestrator] Trying fallback provider: ${fallbackProvider}`);
        
        const fallbackIntegration = await ResolveAIIntegrationService({
          companyId: request.companyId,
          preferProvider: fallbackProvider
        });

        if (fallbackIntegration) {
          return await this.executeRequest(request, fallbackIntegration, requestId);
        }
      } catch (error) {
        console.warn(`[AIOrchestrator] Fallback provider ${fallbackProvider} failed:`, error);
        lastError = error;
        
        // Delay antes de tentar próximo provedor
        if (config.retryDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, config.retryDelay));
        }
      }
    }

    throw lastError || new Error("Todos os provedores IA falharam");
  }

  /**
   * Executa requisição em um provedor específico
   */
  private static async executeRequest(
    request: AIRequest,
    integration: { provider: Provider; config: any },
    requestId: string
  ): Promise<AIResponse> {
    const client = IAClientFactory(integration.provider, integration.config.apiKey);
    const startTime = Date.now();

    // Prepara parâmetros baseado no modo e configurações do preset
    let systemPrompt = request.systemPrompt || this.buildSystemPrompt(request);
    let userPrompt = this.buildUserPrompt(request);
    
    // Se tem configurações de preset, usar o ChatAssistantService para construir prompts corretos
    if (integration.config.systemPrompt || integration.config.tone || integration.config.emotions) {
      try {
        // Verificar se o modo é compatível com ChatAssistantService
        const supportedModes = ["translate", "spellcheck", "enhance"];
        if (supportedModes.includes(request.mode)) {
          const ChatAssistantService = (await import("./usecases/ChatAssistantService")).default;
          const prompts = ChatAssistantService.buildPrompts({
            companyId: request.companyId,
            mode: request.mode as "translate" | "spellcheck" | "enhance",
            text: request.text,
            targetLang: request.targetLang
          }, integration.config);
          
          systemPrompt = prompts.system;
          userPrompt = prompts.user;
          
          console.log(`[AIOrchestrator] Using preset prompts for module: ${request.module}`);
        } else {
          console.log(`[AIOrchestrator] Mode ${request.mode} not supported by ChatAssistantService, using default prompts`);
        }
      } catch (error) {
        console.warn(`[AIOrchestrator] Failed to build preset prompts:`, error.message);
      }
    }

    const chatRequest: ChatRequest = {
      model: request.model || integration.config.model || this.getDefaultModel(integration.provider),
      system: systemPrompt,
      user: userPrompt,
      temperature: request.temperature ?? integration.config.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? integration.config.maxTokens ?? 1000
    };

    console.log(`[AIOrchestrator] Executing on ${integration.provider}`, {
      requestId,
      model: chatRequest.model,
      temperature: chatRequest.temperature
    });

    const result = await client.chat(chatRequest);
    
    return {
      success: true,
      result,
      provider: integration.provider,
      model: chatRequest.model,
      processingTime: Date.now() - startTime,
      ragUsed: false, // será definido pelo método principal
      requestId,
      timestamp: new Date()
    };
  }

  /**
   * Enriquece contexto com informações do RAG
   */
  private static async enrichWithRAG(request: AIRequest): Promise<{
    enrichedText: string;
    results: any[];
  }> {
    if (!request.ragQuery) {
      return { enrichedText: request.text, results: [] };
    }

    const ragParams = {
      companyId: request.companyId,
      query: request.ragQuery,
      k: request.ragFilters?.k || 5,
      tags: request.ragFilters?.tags || [],
      documentId: request.ragFilters?.documentId
    };

    const results = await ragSearch(ragParams);
    
    if (!results || results.length === 0) {
      return { enrichedText: request.text, results: [] };
    }

    // Constrói contexto enriquecido
    const contextChunks = results
      .slice(0, 3) // Limita a 3 resultados mais relevantes
      .map((r, i) => `[Contexto ${i + 1}]: ${r.content}`)
      .join('\n\n');

    const enrichedText = `${request.text}\n\n--- Contexto da base de conhecimento ---\n${contextChunks}`;

    return { enrichedText, results };
  }

  /**
   * Resolve provedor baseado na hierarquia existente (com suporte a presets)
   */
  private static async resolveProvider(request: AIRequest) {
    // Primeiro tenta usar ResolvePresetConfigService para suporte a presets
    try {
      const ResolvePresetConfigService = (await import("./ResolvePresetConfigService")).default;
      const resolved = await ResolvePresetConfigService({
        companyId: request.companyId,
        module: request.module as any,
        preferProvider: request.preferProvider
      });
      
      if (resolved && resolved.config?.apiKey) {
        console.log(`[AIOrchestrator] Using preset config for module: ${request.module}`);
        return {
          provider: resolved.provider,
          config: resolved.config
        };
      }
    } catch (error) {
      console.warn(`[AIOrchestrator] Preset config failed, falling back to legacy:`, error.message);
    }

    // Fallback para método legado
    return await ResolveAIIntegrationService({
      companyId: request.companyId,
      queueId: request.queueId,
      whatsappId: request.whatsappId,
      preferProvider: request.preferProvider
    });
  }

  /**
   * Constrói prompt do sistema baseado no contexto
   */
  private static buildSystemPrompt(request: AIRequest): string {
    if (request.systemPrompt) return request.systemPrompt;

    const basePrompts = {
      enhance: "Você aprimora mensagens para WhatsApp (claras, naturais, sem SPAM).",
      translate: "Você é um tradutor profissional.",
      spellcheck: "Você corrige ortografia e gramática em pt-BR sem mudar o sentido.",
      chat: "Você é um assistente útil e prestativo.",
      rag: "Você responde perguntas baseado no contexto fornecido."
    };

    return basePrompts[request.mode] || basePrompts.chat;
  }

  /**
   * Constrói prompt do usuário baseado no modo
   */
  private static buildUserPrompt(request: AIRequest): string {
    const { mode, text, targetLang } = request;

    switch (mode) {
      case "translate":
        return `Traduza para ${targetLang || "pt-BR"}:\n\n"${text}"`;
      
      case "spellcheck":
        return `Corrija ortografia e gramática:\n\n"${text}"`;
      
      case "enhance":
        return `Aprimore esta mensagem para WhatsApp:\n\n"${text}"`;
      
      default:
        return text;
    }
  }

  /**
   * Modelo padrão por provedor
   */
  private static getDefaultModel(provider: Provider): string {
    const defaults = {
      openai: "gpt-3.5-turbo",
      gemini: "gemini-pro"
    };
    return defaults[provider] || "gpt-3.5-turbo";
  }

  /**
   * Gera ID único para requisição
   */
  private static generateRequestId(): string {
    return `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log básico da requisição (expandir futuramente)
   */
  private static async logRequest(request: AIRequest, response: AIResponse): Promise<void> {
    try {
      console.log(`[AIOrchestrator] Request completed`, {
        requestId: response.requestId,
        module: request.module,
        mode: request.mode,
        provider: response.provider,
        success: response.success,
        processingTime: response.processingTime,
        ragUsed: response.ragUsed
      });
      
      // TODO: Implementar persistência de logs em banco
      // await AIAuditLog.create({ ... });
      
    } catch (error) {
      console.error("[AIOrchestrator] Failed to log request:", error);
      // Não falha a requisição por erro de log
    }
  }

  /**
   * Método de compatibilidade - wrapper para ChatAssistantService
   */
  static async transformText(params: {
    companyId: number;
    text: string;
    mode: "translate" | "spellcheck" | "enhance";
    targetLang?: string;
    integrationType?: "openai" | "gemini";
    queueId?: number | string | null;
    whatsappId?: number | string | null;
    module?: "general" | "campaign" | "ticket" | "prompt";
  }): Promise<string> {
    const request: AIRequest = {
      module: params.module || "general",
      mode: params.mode,
      companyId: params.companyId,
      text: params.text,
      targetLang: params.targetLang,
      preferProvider: params.integrationType,
      queueId: params.queueId,
      whatsappId: params.whatsappId
    };

    const response = await this.processRequest(request);
    
    if (!response.success) {
      throw new Error(response.error || "Falha na transformação de texto");
    }

    return response.result || "";
  }
}
