import { Request, Response } from "express";
import QueueIntegrations from "../models/QueueIntegrations";
import AppError from "../errors/AppError";
import { Op } from "sequelize";

export const test = async (req: Request, res: Response): Promise<Response> => {
  return res.status(200).json({ message: "Preset controller funcionando!", timestamp: new Date() });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  console.log('[PresetController] ===== INÍCIO PRESET STORE =====');
  console.log('[PresetController] Requisição recebida');
  console.log('[PresetController] Headers:', req.headers);
  console.log('[PresetController] Body completo:', req.body);
  console.log('[PresetController] User:', req.user);
  console.log('[PresetController] ===================================');
  
  const { type, name, jsonContent } = req.body;
  const { companyId } = req.user;

  console.log('[PresetController] Dados extraídos:', { type, name, companyId, jsonContent: jsonContent?.substring(0, 100) + '...' });

  if (!type || !type.startsWith('preset-')) {
    console.log('[PresetController] Erro: Tipo inválido:', type);
    throw new AppError("Tipo inválido para preset", 400);
  }

  try {
    // Verificar se já existe um preset do mesmo tipo (módulo)
    const existingPreset = await QueueIntegrations.findOne({
      where: { 
        type, 
        companyId
      }
    });

    if (existingPreset) {
      console.log('[PresetController] Preset do módulo já existe, atualizando...');
      // Atualizar preset existente do módulo
      await existingPreset.update({
        name,
        jsonContent,
        projectName: "",
        language: "pt-BR",
        typebotExpires: 0,
        typebotDelayMessage: 1000,
        urlN8N: "",
        typebotSlug: "",
        typebotKeywordFinish: "",
        typebotUnknownMessage: "",
        typebotKeywordRestart: "",
        typebotRestartMessage: ""
      });
      
      console.log('[PresetController] Preset atualizado com sucesso, ID:', existingPreset.id);
      return res.status(200).json(existingPreset);
    }

    // Criar novo preset para o módulo
    console.log('[PresetController] Criando novo preset para módulo:', type);
    const preset = await QueueIntegrations.create({
      type,
      name,
      jsonContent,
      projectName: "",
      language: "pt-BR",
      companyId,
      typebotExpires: 0,
      typebotDelayMessage: 1000,
      urlN8N: "",
      typebotSlug: "",
      typebotKeywordFinish: "",
      typebotUnknownMessage: "",
      typebotKeywordRestart: "",
      typebotRestartMessage: ""
    });

    console.log('[PresetController] Preset salvo com sucesso, ID:', preset.id);

    return res.status(200).json(preset);
  } catch (error) {
    console.error("Erro detalhado ao salvar preset:", {
      name: error.name,
      message: error.message,
      stack: error.stack?.substring(0, 500)
    });
    
    // Tratar erro de constraint de unicidade
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new AppError("Já existe um preset com este nome ou tipo", 409);
    }
    
    // Tratar erro de validação
    if (error.name === 'SequelizeValidationError') {
      throw new AppError("Dados inválidos: " + error.message, 400);
    }
    
    throw new AppError("Erro interno do servidor ao salvar preset: " + error.message, 500);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  try {
    const presets = await QueueIntegrations.findAll({
      where: { 
        companyId,
        type: {
          [Op.like]: 'preset-%'
        }
      }
    });

    return res.status(200).json(presets);
  } catch (error) {
    console.error("Erro ao buscar presets:", error);
    throw new AppError("Erro interno do servidor ao buscar presets", 500);
  }
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { presetId } = req.params;
  const { companyId } = req.user;

  console.log('[PresetController] Removendo preset:', { presetId, companyId });

  try {
    // Converter presetId para número se necessário
    const id = isNaN(Number(presetId)) ? presetId : Number(presetId);
    
    const preset = await QueueIntegrations.findOne({
      where: { 
        id: id, 
        companyId,
        type: {
          [Op.like]: 'preset-%'
        }
      }
    });

    console.log('[PresetController] Preset encontrado:', preset ? 'SIM' : 'NÃO');

    if (!preset) {
      throw new AppError("Preset não encontrado", 404);
    }

    await preset.destroy();
    console.log('[PresetController] Preset removido com sucesso');

    return res.status(200).json({ message: "Preset removido com sucesso" });
  } catch (error) {
    console.error("Erro ao remover preset:", error);
    throw new AppError("Erro interno do servidor ao remover preset: " + error.message, 500);
  }
};
