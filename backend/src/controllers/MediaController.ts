import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import logger from "../utils/logger";

const publicFolder = path.resolve(__dirname, "..", "..", "public");

/**
 * Serve mídia com suporte a thumbnails e redimensionamento
 * Query params:
 * - thumb=1: retorna thumbnail (qualidade reduzida)
 * - quality=N: qualidade JPEG (1-100, default 80)
 * - maxWidth=N: largura máxima em pixels
 * - maxHeight=N: altura máxima em pixels
 */
export const serveMedia = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { filename } = req.params;
    const { thumb, quality, maxWidth, maxHeight } = req.query;

    if (!filename) {
      return res.status(400).json({ error: "Filename required" });
    }

    // Construir caminho do arquivo
    const filePath = path.join(publicFolder, filename);

    // Verificar se arquivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // Detectar tipo de mídia
    const ext = path.extname(filename).toLowerCase();
    const isImage = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext);

    // Se não é imagem ou não tem parâmetros de transformação, serve arquivo original
    if (!isImage || (!thumb && !quality && !maxWidth && !maxHeight)) {
      return res.sendFile(filePath);
    }

    // Configurar transformação
    const thumbMode = thumb === "1" || thumb === "true";
    const targetQuality = thumbMode ? 30 : Math.min(100, Math.max(1, parseInt(quality as string) || 80));
    const targetMaxWidth = thumbMode ? 200 : parseInt(maxWidth as string) || undefined;
    const targetMaxHeight = thumbMode ? 200 : parseInt(maxHeight as string) || undefined;

    // Gerar chave de cache baseada nos parâmetros
    const cacheKey = `${filename}_q${targetQuality}_w${targetMaxWidth || "auto"}_h${targetMaxHeight || "auto"}`;
    const cachePath = path.join(publicFolder, ".cache", cacheKey + ".jpg");

    // Verificar se já existe no cache
    if (fs.existsSync(cachePath)) {
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400"); // 24h cache
      return res.sendFile(cachePath);
    }

    // Criar diretório de cache se não existir
    const cacheDir = path.join(publicFolder, ".cache");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Processar imagem com sharp
    let pipeline = sharp(filePath);

    // Redimensionar se necessário
    if (targetMaxWidth || targetMaxHeight) {
      pipeline = pipeline.resize(targetMaxWidth, targetMaxHeight, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Converter para JPEG com qualidade especificada
    pipeline = pipeline.jpeg({ quality: targetQuality });

    // Salvar no cache e enviar
    const buffer = await pipeline.toBuffer();
    
    // Salvar em cache de forma assíncrona (não bloqueia resposta)
    fs.writeFile(cachePath, buffer, (err) => {
      if (err) logger.debug(`[MediaController] Erro ao salvar cache: ${err.message}`);
    });

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(buffer);

  } catch (error: any) {
    logger.error(`[MediaController] Erro ao servir mídia: ${error.message}`);
    return res.status(500).json({ error: "Error processing media" });
  }
};

/**
 * Gera thumbnail de vídeo (requer ffmpeg)
 */
export const getVideoThumbnail = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { filename } = req.params;

    if (!filename) {
      return res.status(400).json({ error: "Filename required" });
    }

    const videoPath = path.join(publicFolder, filename);
    const thumbName = filename.replace(/\.[^.]+$/, "_thumb.jpg");
    const thumbPath = path.join(publicFolder, ".cache", thumbName);

    // Verificar se thumbnail já existe
    if (fs.existsSync(thumbPath)) {
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=604800"); // 7 dias
      return res.sendFile(thumbPath);
    }

    // Se vídeo não existe, retorna placeholder
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: "Video not found" });
    }

    // Retorna placeholder genérico (ffmpeg não disponível por padrão)
    // Em produção, pode-se implementar geração de thumbnail com ffmpeg
    return res.status(404).json({ error: "Thumbnail not available" });

  } catch (error: any) {
    logger.error(`[MediaController] Erro ao gerar thumbnail de vídeo: ${error.message}`);
    return res.status(500).json({ error: "Error generating thumbnail" });
  }
};

export default {
  serveMedia,
  getVideoThumbnail,
};
