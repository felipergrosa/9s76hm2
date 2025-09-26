import QueueIntegrations from "../../models/QueueIntegrations";
import { ModuleType, PresetConfig } from "./ResolvePresetConfigService";

interface CreatePresetParams {
  companyId: number;
  preset: PresetConfig;
}

interface UpdatePresetParams {
  companyId: number;
  module: ModuleType;
  preset: PresetConfig;
}

export default class PresetService {
  /**
   * Salva ou atualiza um preset para um módulo específico
   */
  static async savePreset({ companyId, preset }: CreatePresetParams): Promise<void> {
    const type = `preset-${preset.module}`;
    
    // Verifica se já existe um preset para este módulo
    const existing = await QueueIntegrations.findOne({
      where: { companyId, type }
    });

    const presetData = {
      name: preset.name,
      module: preset.module,
      systemPrompt: preset.systemPrompt,
      temperature: preset.temperature,
      maxTokens: preset.maxTokens,
      tone: preset.tone,
      emotions: preset.emotions,
      hashtags: preset.hashtags,
      length: preset.length,
      language: preset.language,
      brandVoice: preset.brandVoice,
      allowedVariables: preset.allowedVariables
    };

    if (existing) {
      // Atualiza preset existente
      await existing.update({
        name: preset.name,
        jsonContent: JSON.stringify(presetData)
      });
      console.log(`[PresetService] Preset atualizado para módulo ${preset.module}`);
    } else {
      // Cria novo preset
      await QueueIntegrations.create({
        companyId,
        type,
        name: preset.name,
        jsonContent: JSON.stringify(presetData)
      });
      console.log(`[PresetService] Novo preset criado para módulo ${preset.module}`);
    }
  }

  /**
   * Busca preset de um módulo específico
   */
  static async getPreset(companyId: number, module: ModuleType): Promise<PresetConfig | null> {
    const type = `preset-${module}`;
    
    const integration = await QueueIntegrations.findOne({
      where: { companyId, type }
    });

    if (!integration || !integration.jsonContent) {
      return null;
    }

    try {
      return JSON.parse(integration.jsonContent) as PresetConfig;
    } catch {
      return null;
    }
  }

  /**
   * Lista todos os presets da empresa
   */
  static async listPresets(companyId: number): Promise<PresetConfig[]> {
    const integrations = await QueueIntegrations.findAll({
      where: { 
        companyId,
        type: {
          [require('sequelize').Op.like]: 'preset-%'
        }
      }
    });

    const presets: PresetConfig[] = [];
    
    for (const integration of integrations) {
      if (integration.jsonContent) {
        try {
          const preset = JSON.parse(integration.jsonContent) as PresetConfig;
          presets.push(preset);
        } catch {
          // Ignora presets com JSON inválido
        }
      }
    }

    return presets;
  }

  /**
   * Remove preset de um módulo
   */
  static async deletePreset(companyId: number, module: ModuleType): Promise<void> {
    const type = `preset-${module}`;
    
    await QueueIntegrations.destroy({
      where: { companyId, type }
    });

    console.log(`[PresetService] Preset removido para módulo ${module}`);
  }
}
