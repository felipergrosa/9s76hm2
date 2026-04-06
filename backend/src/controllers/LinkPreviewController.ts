import { Request, Response } from "express";
import {
  getLinkPreview,
  detectUrl,
  resolvePreviewImage,
  enhancePreviewImage
} from "../services/WbotServices/LinkPreviewService";
import logger from "../utils/logger";

export const getLinkPreviewData = async (req: Request, res: Response): Promise<Response> => {
  const { url, fallbackImage } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL é obrigatória" });
  }

  try {
    const preview = await getLinkPreview(url);
    
    if (!preview) {
      return res.status(404).json({ error: "Não foi possível extrair metadados desta URL" });
    }
    
    const resolvedImage = await resolvePreviewImage(preview.image);
    const image = resolvedImage || (await enhancePreviewImage(fallbackImage));

    return res.json({
      title: preview.title,
      description: preview.description,
      image,
      url: preview.url
    });
  } catch (error) {
    logger.error(`[LinkPreviewController] Erro ao buscar preview: ${error.message}`);
    return res.status(500).json({ error: "Erro ao buscar preview do link" });
  }
};

export const detectAndPreview = async (req: Request, res: Response): Promise<Response> => {
  const { text, fallbackImage } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Texto é obrigatório" });
  }

  try {
    const url = detectUrl(text);
    
    if (!url) {
      return res.json({ hasUrl: false });
    }
    
    const preview = await getLinkPreview(url);
    
    const hydratedPreview = preview
      ? {
          ...preview,
          image:
            (await resolvePreviewImage(preview.image)) ||
            (await enhancePreviewImage(fallbackImage))
        }
      : null;

    return res.json({
      hasUrl: true,
      url,
      preview: hydratedPreview
    });
  } catch (error) {
    logger.error(`[LinkPreviewController] Erro: ${error.message}`);
    return res.status(500).json({ error: "Erro ao processar texto" });
  }
};
