import { Request, Response } from "express";
import { getLinkPreview, detectUrl } from "../services/WbotServices/LinkPreviewService";
import logger from "../utils/logger";

export const getLinkPreviewData = async (req: Request, res: Response): Promise<Response> => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL é obrigatória" });
  }

  try {
    logger.info(`[LinkPreviewController] Buscando preview para: ${url}`);
    
    const preview = await getLinkPreview(url);
    
    if (!preview) {
      return res.status(404).json({ error: "Não foi possível extrair metadados desta URL" });
    }

    logger.info(`[LinkPreviewController] Preview encontrado: ${preview.title}`);
    
    return res.json({
      title: preview.title,
      description: preview.description,
      image: preview.image,
      url: preview.url
    });
  } catch (error) {
    logger.error(`[LinkPreviewController] Erro ao buscar preview: ${error.message}`);
    return res.status(500).json({ error: "Erro ao buscar preview do link" });
  }
};

export const detectAndPreview = async (req: Request, res: Response): Promise<Response> => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Texto é obrigatório" });
  }

  try {
    const url = detectUrl(text);
    
    if (!url) {
      return res.json({ hasUrl: false });
    }

    logger.info(`[LinkPreviewController] URL detectada: ${url}`);
    
    const preview = await getLinkPreview(url);
    
    return res.json({
      hasUrl: true,
      url,
      preview: preview || null
    });
  } catch (error) {
    logger.error(`[LinkPreviewController] Erro: ${error.message}`);
    return res.status(500).json({ error: "Erro ao processar texto" });
  }
};
