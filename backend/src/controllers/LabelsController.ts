import { Request, Response } from "express";
import WhatsAppLabelsService from "../services/WbotServices/WhatsAppLabelsService";
import ForceAppStateSyncService from "../services/WbotServices/ForceAppStateSyncService";
import logger from "../utils/logger";

export const syncLabels = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { whatsappId } = req.query as any;

  try {
    // Forçar sync do App State primeiro
    await ForceAppStateSyncService(companyId, whatsappId ? Number(whatsappId) : undefined);
    
    // Aguardar um pouco para os eventos chegarem
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Sincronizar para o banco
    await WhatsAppLabelsService.syncLabelsToDatabase(companyId, whatsappId ? Number(whatsappId) : undefined);
    
    return res.status(200).json({ 
      success: true, 
      message: "Labels sincronizadas com sucesso" 
    });
  } catch (error: any) {
    logger.error("Erro ao sincronizar labels:", error);
    return res.status(500).json({ 
      success: false, 
      error: error?.message || "Erro ao sincronizar labels" 
    });
  }
};

export const getLabelsStats = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { whatsappId } = req.query as any;

  try {
    const stats = await WhatsAppLabelsService.getLabelsStats(companyId, whatsappId ? Number(whatsappId) : undefined);
    
    return res.status(200).json({ 
      success: true, 
      data: stats 
    });
  } catch (error: any) {
    logger.error("Erro ao obter estatísticas das labels:", error);
    return res.status(500).json({ 
      success: false, 
      error: error?.message || "Erro ao obter estatísticas das labels" 
    });
  }
};

export const importContactsByLabel = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { labelId } = req.params;
  const { whatsappId } = req.query as any;

  try {
    const result = await WhatsAppLabelsService.importContactsByLabel(
      companyId, 
      labelId, 
      whatsappId ? Number(whatsappId) : undefined
    );
    
    return res.status(200).json({ 
      success: true, 
      data: result,
      message: `${result.imported} contatos importados, ${result.skipped} já existiam`
    });
  } catch (error: any) {
    logger.error("Erro ao importar contatos por label:", error);
    return res.status(500).json({ 
      success: false, 
      error: error?.message || "Erro ao importar contatos por label" 
    });
  }
};

export const addLabelToContact = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { contactNumber, labelId } = req.body;
  const { whatsappId } = req.query as any;

  try {
    await WhatsAppLabelsService.addLabelToContact(
      companyId, 
      contactNumber, 
      labelId, 
      whatsappId ? Number(whatsappId) : undefined
    );
    
    return res.status(200).json({ 
      success: true, 
      message: "Label adicionada ao contato com sucesso" 
    });
  } catch (error: any) {
    logger.error("Erro ao adicionar label ao contato:", error);
    return res.status(500).json({ 
      success: false, 
      error: error?.message || "Erro ao adicionar label ao contato" 
    });
  }
};

export const removeLabelFromContact = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { contactNumber, labelId } = req.body;
  const { whatsappId } = req.query as any;

  try {
    await WhatsAppLabelsService.removeLabelFromContact(
      companyId, 
      contactNumber, 
      labelId, 
      whatsappId ? Number(whatsappId) : undefined
    );
    
    return res.status(200).json({ 
      success: true, 
      message: "Label removida do contato com sucesso" 
    });
  } catch (error: any) {
    logger.error("Erro ao remover label do contato:", error);
    return res.status(500).json({ 
      success: false, 
      error: error?.message || "Erro ao remover label do contato" 
    });
  }
};

export const createLabel = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { name, color = 0 } = req.body;
  const { whatsappId } = req.query as any;

  try {
    const labelId = await WhatsAppLabelsService.createLabel(
      companyId, 
      name, 
      color, 
      whatsappId ? Number(whatsappId) : undefined
    );
    
    return res.status(200).json({ 
      success: true, 
      data: { labelId },
      message: "Label criada com sucesso" 
    });
  } catch (error: any) {
    logger.error("Erro ao criar label:", error);
    return res.status(500).json({ 
      success: false, 
      error: error?.message || "Erro ao criar label" 
    });
  }
};
