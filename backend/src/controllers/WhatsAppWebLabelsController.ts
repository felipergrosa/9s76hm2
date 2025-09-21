import { Request, Response } from "express";
import logger from "../utils/logger";

export const getDeviceLabelsWWeb = async (req: Request, res: Response) => {
  try {
    const companyId = (req.user as any)?.companyId;
    const whatsappId = req.query.whatsappId ? Number(req.query.whatsappId) : undefined;

    logger.info(`[getDeviceLabelsWWeb] Buscando labels via WhatsApp-Web.js para company=${companyId}, whatsappId=${whatsappId}`);

    // Importar o service dinamicamente para evitar erros de compilação
    const whatsAppWebLabelsService = require("../services/WbotServices/WhatsAppWebLabelsService").default;
    
    const labels = await whatsAppWebLabelsService.getDeviceLabels(companyId, whatsappId);

    logger.info(`[getDeviceLabelsWWeb] Encontradas ${labels.length} labels via WhatsApp-Web.js`);

    return res.json({
      success: true,
      labels,
      count: labels.length,
      source: "whatsapp-web.js"
    });

  } catch (error: any) {
    logger.error(`[getDeviceLabelsWWeb] Erro: ${error?.message}`);
    return res.status(500).json({
      success: false,
      error: error?.message || "Erro ao buscar labels via WhatsApp-Web.js"
    });
  }
};

export const cancelLabelsOperationWWeb = async (req: Request, res: Response) => {
  try {
    const companyId = (req.user as any)?.companyId;
    const whatsappId = req.query.whatsappId ? Number(req.query.whatsappId) : undefined;

    const whatsAppWebLabelsService = require("../services/WbotServices/WhatsAppWebLabelsService").default;
    const GetDefaultWhatsApp = require("../helpers/GetDefaultWhatsApp").default;

    const def = await GetDefaultWhatsApp(whatsappId, companyId);
    whatsAppWebLabelsService.requestCancel(def.id);
    return res.json({ success: true, whatsappId: def.id, cancelled: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || 'Erro ao cancelar operação de labels' });
  }
};

export const getContactsByLabelWWeb = async (req: Request, res: Response) => {
  try {
    return res.json({
      success: true,
      message: "Endpoint de contatos funcionando!",
      contacts: [],
      count: 0,
      source: "whatsapp-web.js-test"
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Erro ao buscar contatos da label via WhatsApp-Web.js"
    });
  }
};

export const getLabelsStatusWWeb = async (req: Request, res: Response) => {
  try {
    const companyId = (req.user as any)?.companyId;
    const whatsappId = req.query.whatsappId ? Number(req.query.whatsappId) : undefined;

    // Importar o service dinamicamente
    const whatsAppWebLabelsService = require("../services/WbotServices/WhatsAppWebLabelsService").default;
    const GetDefaultWhatsApp = require("../helpers/GetDefaultWhatsApp").default;
    
    const defaultWhatsapp = await GetDefaultWhatsApp(whatsappId, companyId);
    const status = whatsAppWebLabelsService.getConnectionStatus(defaultWhatsapp.id);
    const qrCode = whatsAppWebLabelsService.getQRCode(defaultWhatsapp.id);

    return res.json({
      success: true,
      whatsappId: defaultWhatsapp.id,
      connected: status.connected,
      initializing: status.initializing,
      hasQR: status.hasQR,
      status: status.status,
      qrCode: qrCode,
      message: status.connected 
        ? "WhatsApp Web conectado" 
        : status.hasQR
          ? "QR Code gerado - Escaneie com seu WhatsApp"
        : status.initializing 
          ? "Inicializando conexão..." 
          : "Não conectado",
      source: "whatsapp-web.js"
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Erro ao verificar status do WhatsApp-Web.js"
    });
  }
};

export const getLabelsProgressWWeb = async (req: Request, res: Response) => {
  try {
    const companyId = (req.user as any)?.companyId;
    const whatsappId = req.query.whatsappId ? Number(req.query.whatsappId) : undefined;

    // Importar o service dinamicamente
    const whatsAppWebLabelsService = require("../services/WbotServices/WhatsAppWebLabelsService").default;
    const GetDefaultWhatsApp = require("../helpers/GetDefaultWhatsApp").default;

    const def = await GetDefaultWhatsApp(whatsappId, companyId);
    const progress = whatsAppWebLabelsService.getLabelsProgress(def.id);

    return res.json({ success: true, whatsappId: def.id, ...progress });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || 'Erro ao obter progresso de labels' });
  }
};

export const initializeWhatsAppWebConnection = async (req: Request, res: Response) => {
  try {
    const companyId = (req.user as any)?.companyId;
    const whatsappId = req.query.whatsappId ? Number(req.query.whatsappId) : undefined;

    logger.info(`[initializeWhatsAppWebConnection] Iniciando conexão para company=${companyId}, whatsappId=${whatsappId}`);

    // Importar o service dinamicamente
    const whatsAppWebLabelsService = require("../services/WbotServices/WhatsAppWebLabelsService").default;
    const GetDefaultWhatsApp = require("../helpers/GetDefaultWhatsApp").default;
    
    const defaultWhatsapp = await GetDefaultWhatsApp(whatsappId, companyId);
    
    // Iniciar conexão em background
    whatsAppWebLabelsService.getOrCreateClient(defaultWhatsapp.id).catch((err: any) => {
      logger.error(`[initializeWhatsAppWebConnection] Erro na inicialização: ${err?.message}`);
    });

    return res.json({
      success: true,
      message: "Inicialização do WhatsApp Web iniciada. Verifique o status para acompanhar o progresso.",
      whatsappId: defaultWhatsapp.id
    });

  } catch (error: any) {
    logger.error(`[initializeWhatsAppWebConnection] Erro: ${error?.message}`);
    return res.status(500).json({
      success: false,
      error: error?.message || "Erro ao inicializar WhatsApp-Web.js"
    });
  }
};
