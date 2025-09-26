import GetIntegrationByTypeService from "../QueueIntegrationServices/GetIntegrationByTypeService";
import { decryptString } from "../../utils/crypto";

export type ModuleType = "general" | "campaign" | "ticket" | "prompt";
export type Provider = "openai" | "gemini";

export interface PresetConfig {
  name: string;
  module: ModuleType;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  tone?: string;
  emotions?: string;
  hashtags?: string;
  length?: string;
  language?: string;
  brandVoice?: string;
  allowedVariables?: string;
}

export interface ResolvedConfig {
  provider: Provider;
  config: any;
  source: "preset" | "global";
  preset?: PresetConfig;
}

/**
 * Resolve configurações de IA com fallback inteligente:
 * 1. Busca preset específico do módulo
 * 2. Se não encontrar, usa configurações globais dos provedores
 */
const ResolvePresetConfigService = async ({
  companyId,
  module,
  preferProvider
}: {
  companyId: number;
  module: ModuleType;
  preferProvider?: Provider;
}): Promise<ResolvedConfig | null> => {
  
  console.log(`[ResolvePresetConfig] Resolvendo para módulo: ${module}, companyId: ${companyId}`);

  // 1. Primeiro tenta buscar preset específico do módulo
  try {
    const presetIntegration = await GetIntegrationByTypeService({ 
      companyId, 
      type: `preset-${module}` 
    });
    
    if (presetIntegration?.jsonContent) {
      console.log(`[ResolvePresetConfig] jsonContent type:`, typeof presetIntegration.jsonContent);
      console.log(`[ResolvePresetConfig] jsonContent value:`, presetIntegration.jsonContent);
      
      let presetConfig: PresetConfig;
      try {
        // GetIntegrationByTypeService já retorna o objeto parseado
        if (typeof presetIntegration.jsonContent === 'object' && presetIntegration.jsonContent !== null) {
          presetConfig = presetIntegration.jsonContent as PresetConfig;
        } else if (typeof presetIntegration.jsonContent === 'string') {
          presetConfig = JSON.parse(presetIntegration.jsonContent) as PresetConfig;
        } else {
          throw new Error('jsonContent inválido');
        }
        
        console.log(`[ResolvePresetConfig] Preset config carregado:`, {
          name: presetConfig.name,
          hasSystemPrompt: !!presetConfig.systemPrompt,
          temperature: presetConfig.temperature,
          emotions: presetConfig.emotions
        });
      } catch (parseError) {
        console.error(`[ResolvePresetConfig] Erro ao processar jsonContent:`, parseError);
        throw new Error(`Erro ao processar configuração do preset: ${parseError.message}`);
      }
      
      // Se encontrou preset, busca o provedor configurado para usar com esse preset
      const providerToUse = preferProvider || "openai";
      const providerIntegration = await GetIntegrationByTypeService({ 
        companyId, 
        type: providerToUse 
      });
      
      if (providerIntegration?.jsonContent?.apiKey) {
        console.log(`[ResolvePresetConfig] Usando preset do módulo ${module} com provedor ${providerToUse}`);
        
        // Mescla configurações do preset com as do provedor
        const mergedConfig = {
          ...providerIntegration.jsonContent,
          // Sobrescreve com configurações específicas do preset
          temperature: presetConfig.temperature || providerIntegration.jsonContent.temperature,
          maxTokens: presetConfig.maxTokens || providerIntegration.jsonContent.maxTokens,
          systemPrompt: presetConfig.systemPrompt,
          tone: presetConfig.tone,
          emotions: presetConfig.emotions,
          hashtags: presetConfig.hashtags,
          length: presetConfig.length,
          language: presetConfig.language,
          brandVoice: presetConfig.brandVoice,
          allowedVariables: presetConfig.allowedVariables
        };
        
        console.log(`[ResolvePresetConfig] Configurações mescladas:`, {
          hasSystemPrompt: !!mergedConfig.systemPrompt,
          temperature: mergedConfig.temperature,
          emotions: mergedConfig.emotions,
          tone: mergedConfig.tone,
          hashtags: mergedConfig.hashtags
        });
        
        return {
          provider: providerToUse,
          config: mergedConfig,
          source: "preset",
          preset: presetConfig
        };
      }
    }
  } catch (error) {
    console.log(`[ResolvePresetConfig] Preset não encontrado para módulo ${module}:`, error.message);
  }

  // 2. Fallback: usa configurações globais dos provedores
  console.log(`[ResolvePresetConfig] Usando fallback para configurações globais`);
  
  // Tenta provedor preferido primeiro
  if (preferProvider) {
    try {
      const integration = await GetIntegrationByTypeService({ companyId, type: preferProvider });
      if (integration?.jsonContent?.apiKey) {
        console.log(`[ResolvePresetConfig] Usando configuração global ${preferProvider}`);
        return {
          provider: preferProvider,
          config: integration.jsonContent,
          source: "global"
        };
      }
    } catch {}
  }

  // Fallback: OpenAI primeiro, depois Gemini
  try {
    const openai = await GetIntegrationByTypeService({ companyId, type: "openai" });
    if (openai?.jsonContent?.apiKey) {
      console.log(`[ResolvePresetConfig] Usando configuração global OpenAI`);
      return {
        provider: "openai",
        config: openai.jsonContent,
        source: "global"
      };
    }
  } catch {}

  try {
    const gemini = await GetIntegrationByTypeService({ companyId, type: "gemini" });
    if (gemini?.jsonContent?.apiKey) {
      console.log(`[ResolvePresetConfig] Usando configuração global Gemini`);
      return {
        provider: "gemini",
        config: gemini.jsonContent,
        source: "global"
      };
    }
  } catch {}

  console.log(`[ResolvePresetConfig] Nenhuma configuração encontrada`);
  return null;
};

export default ResolvePresetConfigService;
