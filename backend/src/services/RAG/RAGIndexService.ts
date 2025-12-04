import sequelize from "../../database";
import KnowledgeDocument from "../../models/KnowledgeDocument";
import KnowledgeChunk from "../../models/KnowledgeChunk";
import { splitIntoChunks } from "./ChunkUtils";
import { embedTexts } from "./EmbeddingService";
import PDFProcessor from "./processors/PDFProcessor";
import ImageProcessor from "./processors/ImageProcessor";
import VideoProcessor from "./processors/VideoProcessor";
import AudioProcessor from "./processors/AudioProcessor";
import GifProcessor from "./processors/GifProcessor";
import ExcelProcessor from "./processors/ExcelProcessor";
import path from "path";

export interface IndexTextParams {
  companyId: number;
  title: string;
  text: string;
  tags?: string[];
  source?: string;
  mimeType?: string;
  chunkSize?: number;
  overlap?: number;
  metadata?: Record<string, any>;
}

export interface IndexResult {
  documentId: number;
  chunks: number;
}

export const indexTextDocument = async (params: IndexTextParams): Promise<IndexResult> => {
  const { companyId, title, text, tags = [], source, mimeType, chunkSize, overlap, metadata } = params;
  if (!text || !title) throw new Error("title e text são obrigatórios");

  const chunks = splitIntoChunks(text, { chunkSize, overlap });
  if (!chunks.length) throw new Error("Nenhum conteúdo válido para indexar");

  const embeddings = await embedTexts(companyId, chunks);

  const now = new Date();
  
  // Usar transação explícita para garantir commit imediato
  const transaction = await sequelize.transaction();
  try {
    const doc = await KnowledgeDocument.create({
      companyId,
      title,
      source,
      mimeType,
      size: text.length,
      tags: JSON.stringify(tags),
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      createdAt: now,
      updatedAt: now,
    } as any, { transaction });

    // Salvar chunks na mesma transação
    const valuesSql = chunks.map((c, i) =>
      `(${companyId}, ${doc.id}, ${i}, :content_${i}, :emb_${i}::vector, :tags_${i}, NULL, :now, :now)`
    ).join(",\n");

    const replacements: any = { now: now.toISOString() };
    chunks.forEach((c, i) => {
      replacements[`content_${i}`] = c;
      replacements[`tags_${i}`] = JSON.stringify(tags);
      const vector = `[${embeddings[i].join(",")}]`;
      replacements[`emb_${i}`] = vector;
    });

    await sequelize.query(
      `INSERT INTO "KnowledgeChunks" ("companyId","documentId","chunkIndex","content","embedding","tags","metadata","createdAt","updatedAt") VALUES\n${valuesSql}`,
      { replacements, transaction }
    );

    // Commit explícito
    await transaction.commit();
    
    return { documentId: doc.id, chunks: chunks.length };
    
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Indexa arquivo PDF extraindo texto automaticamente
 */
export const indexPDFDocument = async (params: {
  companyId: number;
  title: string;
  filePath: string;
  tags?: string[];
  source?: string;
  chunkSize?: number;
  overlap?: number;
}): Promise<IndexResult> => {
  const { companyId, title, filePath, tags = [], source, chunkSize, overlap } = params;
  
  console.log(`[RAG] Indexing PDF: ${title}`);
  
  if (!PDFProcessor.isValidPDF(filePath)) {
    throw new Error("Arquivo não é um PDF válido");
  }

  try {
    const pdfResult = await PDFProcessor.extractText(filePath);
    
    if (!pdfResult.text || pdfResult.text.length < 50) {
      throw new Error("PDF não contém texto suficiente para indexação");
    }

    // Adiciona metadados do PDF às tags
    const enrichedTags = [
      ...tags,
      'pdf',
      `pages:${pdfResult.pages}`,
      ...(pdfResult.metadata?.title ? [`title:${pdfResult.metadata.title}`] : []),
      ...(pdfResult.metadata?.author ? [`author:${pdfResult.metadata.author}`] : [])
    ];

    console.log(`[RAG] PDF processed: ${pdfResult.text.length} chars, ${pdfResult.pages} pages`);

    return await indexTextDocument({
      companyId,
      title,
      text: pdfResult.text,
      tags: enrichedTags,
      source,
      mimeType: 'application/pdf',
      chunkSize,
      overlap
    });

  } catch (error: any) {
    console.error(`[RAG] Failed to index PDF ${title}:`, error.message);
    throw new Error(`Falha ao processar PDF: ${error.message}`);
  }
};

/**
 * Indexa imagem extraindo texto via OCR
 */
export const indexImageDocument = async (params: {
  companyId: number;
  title: string;
  filePath: string;
  tags?: string[];
  source?: string;
  chunkSize?: number;
  overlap?: number;
}): Promise<IndexResult> => {
  const { companyId, title, filePath, tags = [], source, chunkSize, overlap } = params;
  
  console.log(`[RAG] Indexing Image: ${title}`);
  
  if (!ImageProcessor.isValidImage(filePath)) {
    throw new Error("Arquivo não é uma imagem suportada");
  }

  try {
    const imageResult = await ImageProcessor.extractText(filePath);
    
    if (!imageResult.text || imageResult.text.length < 20) {
      console.warn(`[RAG] Image has little text content: ${imageResult.text.length} chars`);
      // Continua mesmo com pouco texto - pode ser útil para busca
    }

    // Adiciona metadados da imagem às tags
    const enrichedTags = [
      ...tags,
      'image',
      `confidence:${Math.round(imageResult.confidence)}`,
      ...(imageResult.metadata?.format ? [`format:${imageResult.metadata.format}`] : []),
      ...(imageResult.metadata?.hasText ? ['has_text'] : ['no_text'])
    ];

    console.log(`[RAG] Image processed: ${imageResult.text.length} chars, confidence: ${imageResult.confidence}%`);

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg', 
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp'
    }[ext] || 'image/unknown';

    return await indexTextDocument({
      companyId,
      title,
      text: imageResult.text,
      tags: enrichedTags,
      source,
      mimeType,
      chunkSize,
      overlap
    });

  } catch (error: any) {
    console.error(`[RAG] Failed to index image ${title}:`, error.message);
    throw new Error(`Falha ao processar imagem: ${error.message}`);
  }
};

/**
 * Indexa arquivo automaticamente baseado na extensão
 */
export const indexFileAuto = async (params: {
  companyId: number;
  title: string;
  filePath: string;
  tags?: string[];
  source?: string;
  chunkSize?: number;
  overlap?: number;
  metadata?: Record<string, any>;
}): Promise<IndexResult> => {
  const { filePath } = params;
  const ext = path.extname(filePath).toLowerCase();
  
  console.log(`[RAG] Auto-indexing file: ${path.basename(filePath)} (${ext})`);

  // PDFs
  if (ext === '.pdf') {
    return await indexPDFDocument(params);
  }
  
  // GIF (processamento especial com OCR de frames)
  if (ext === '.gif') {
    return await indexGifDocumentInternal(params);
  }
  
  // Imagens
  if (['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff', '.tif'].includes(ext)) {
    return await indexImageDocument(params);
  }
  
  // Excel
  if (['.xls', '.xlsx'].includes(ext)) {
    return await indexExcelDocumentInternal(params);
  }
  
  // Vídeos
  if (['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v'].includes(ext)) {
    return await indexVideoDocumentInternal(params);
  }
  
  // Áudios
  if (['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg', '.wma'].includes(ext)) {
    return await indexAudioDocumentInternal(params);
  }
  
  // Texto (método existente)
  if (['.txt', '.md', '.csv', '.json'].includes(ext)) {
    const fs = require('fs');
    const text = fs.readFileSync(filePath, 'utf8');
    
    return await indexTextDocument({
      ...params,
      text,
      mimeType: {
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.csv': 'text/csv',
        '.json': 'application/json'
      }[ext] || 'text/plain'
    });
  }
  
  throw new Error(`Tipo de arquivo não suportado: ${ext}`);
};

/**
 * Indexa vídeo extraindo áudio e transcrevendo
 */
const indexVideoDocumentInternal = async (params: {
  companyId: number;
  title: string;
  filePath: string;
  tags?: string[];
  source?: string;
  chunkSize?: number;
  overlap?: number;
}): Promise<IndexResult> => {
  const { companyId, title, filePath, tags = [], source, chunkSize, overlap } = params;
  
  console.log(`[RAG] Indexing Video: ${title}`);
  
  if (!VideoProcessor.isValidVideo(filePath)) {
    throw new Error("Arquivo não é um vídeo suportado");
  }

  try {
    // Obter API Key da OpenAI para transcrição
    const GetIntegrationByTypeService = require('../QueueIntegrationServices/GetIntegrationByTypeService').default;
    let openaiApiKey: string | undefined;
    
    try {
      const integration = await GetIntegrationByTypeService({ companyId, type: 'openai' });
      const config = typeof integration?.jsonContent === 'string' ? JSON.parse(integration.jsonContent) : integration?.jsonContent || {};
      openaiApiKey = config?.apiKey;
    } catch {}

    const videoResult = await VideoProcessor.extractText(filePath, openaiApiKey);
    
    // Adiciona metadados do vídeo às tags
    const enrichedTags = [
      ...tags,
      'video',
      `duration:${Math.round(videoResult.duration)}s`,
      ...(videoResult.metadata.resolution ? [`resolution:${videoResult.metadata.resolution}`] : []),
      ...(videoResult.metadata.hasAudio ? ['has_audio'] : ['no_audio'])
    ];

    console.log(`[RAG] Video processed: ${videoResult.text.length} chars, ${videoResult.duration}s duration`);

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = {
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.mkv': 'video/x-matroska',
      '.webm': 'video/webm'
    }[ext] || 'video/unknown';

    return await indexTextDocument({
      companyId,
      title,
      text: videoResult.text,
      tags: enrichedTags,
      source,
      mimeType,
      chunkSize,
      overlap,
      metadata: {
        duration: videoResult.duration,
        resolution: videoResult.metadata.resolution,
        fps: videoResult.metadata.fps,
        hasAudio: videoResult.metadata.hasAudio
      }
    });

  } catch (error: any) {
    console.error(`[RAG] Failed to index video ${title}:`, error.message);
    throw new Error(`Falha ao processar vídeo: ${error.message}`);
  }
};

/**
 * Indexa áudio transcrevendo o conteúdo
 */
const indexAudioDocumentInternal = async (params: {
  companyId: number;
  title: string;
  filePath: string;
  tags?: string[];
  source?: string;
  chunkSize?: number;
  overlap?: number;
}): Promise<IndexResult> => {
  const { companyId, title, filePath, tags = [], source, chunkSize, overlap } = params;
  
  console.log(`[RAG] Indexing Audio: ${title}`);
  
  if (!AudioProcessor.isValidAudio(filePath)) {
    throw new Error("Arquivo não é um áudio suportado");
  }

  try {
    // Obter API Key da OpenAI para transcrição
    const GetIntegrationByTypeService = require('../QueueIntegrationServices/GetIntegrationByTypeService').default;
    let openaiApiKey: string | undefined;
    
    try {
      const integration = await GetIntegrationByTypeService({ companyId, type: 'openai' });
      const config = typeof integration?.jsonContent === 'string' ? JSON.parse(integration.jsonContent) : integration?.jsonContent || {};
      openaiApiKey = config?.apiKey;
    } catch {}

    const audioResult = await AudioProcessor.extractText(filePath, openaiApiKey);
    
    // Adiciona metadados do áudio às tags
    const enrichedTags = [
      ...tags,
      'audio',
      `duration:${Math.round(audioResult.duration)}s`,
      ...(audioResult.metadata.channels ? [`channels:${audioResult.metadata.channels}`] : []),
      ...(audioResult.metadata.bitrate ? [`bitrate:${audioResult.metadata.bitrate}kbps`] : [])
    ];

    console.log(`[RAG] Audio processed: ${audioResult.text.length} chars, ${audioResult.duration}s duration`);

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.flac': 'audio/flac',
      '.aac': 'audio/aac',
      '.ogg': 'audio/ogg'
    }[ext] || 'audio/unknown';

    return await indexTextDocument({
      companyId,
      title,
      text: audioResult.text,
      tags: enrichedTags,
      source,
      mimeType,
      chunkSize,
      overlap,
      metadata: {
        duration: audioResult.duration,
        channels: audioResult.metadata.channels,
        sampleRate: audioResult.metadata.sampleRate,
        bitrate: audioResult.metadata.bitrate
      }
    });

  } catch (error: any) {
    console.error(`[RAG] Failed to index audio ${title}:`, error.message);
    throw new Error(`Falha ao processar áudio: ${error.message}`);
  }
};

/**
 * Indexa GIF extraindo texto dos frames via OCR
 */
const indexGifDocumentInternal = async (params: {
  companyId: number;
  title: string;
  filePath: string;
  tags?: string[];
  source?: string;
  chunkSize?: number;
  overlap?: number;
}): Promise<IndexResult> => {
  const { companyId, title, filePath, tags = [], source, chunkSize, overlap } = params;
  
  console.log(`[RAG] Indexing GIF: ${title}`);
  
  if (!GifProcessor.isValidGif(filePath)) {
    throw new Error("Arquivo não é um GIF válido");
  }

  try {
    const gifResult = await GifProcessor.extractText(filePath);
    
    // Adiciona metadados do GIF às tags
    const enrichedTags = [
      ...tags,
      'gif',
      `frames:${gifResult.frameCount}`,
      `duration:${Math.round(gifResult.duration)}s`,
      ...(gifResult.metadata.hasText ? ['has_text'] : ['no_text']),
      ...(gifResult.metadata.confidence > 50 ? ['high_confidence'] : ['low_confidence'])
    ];

    console.log(`[RAG] GIF processed: ${gifResult.text.length} chars, ${gifResult.frameCount} frames, confidence: ${gifResult.metadata.confidence}%`);

    return await indexTextDocument({
      companyId,
      title,
      text: gifResult.text,
      tags: enrichedTags,
      source,
      mimeType: 'image/gif',
      chunkSize,
      overlap,
      metadata: {
        frameCount: gifResult.frameCount,
        duration: gifResult.duration,
        resolution: gifResult.metadata.resolution,
        fps: gifResult.metadata.fps,
        hasText: gifResult.metadata.hasText,
        confidence: gifResult.metadata.confidence
      }
    });

  } catch (error: any) {
    console.error(`[RAG] Failed to index GIF ${title}:`, error.message);
    throw new Error(`Falha ao processar GIF: ${error.message}`);
  }
};

/**
 * Indexa Excel extraindo texto
 */
const indexExcelDocumentInternal = async (params: {
  companyId: number;
  title: string;
  filePath: string;
  tags?: string[];
  source?: string;
  chunkSize?: number;
  overlap?: number;
}): Promise<IndexResult> => {
  const { companyId, title, filePath, tags = [], source, chunkSize, overlap } = params;

  console.log(`[RAG] Indexing Excel: ${title}`);

  if (!ExcelProcessor.isValidExcel(filePath)) {
    throw new Error("Arquivo não é um Excel suportado");
  }

  try {
    const excelResult = await ExcelProcessor.extractText(filePath);

    const enrichedTags = [
      ...tags,
      "excel",
      ...(excelResult.metadata?.sheetNames || []).map(name => `sheet:${name}`)
    ];

    console.log(
      `[RAG] Excel processed: ${excelResult.text.length} chars, ${excelResult.sheets} sheets`
    );

    const ext = path.extname(filePath).toLowerCase();
    const mimeType =
      {
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }[ext] || "application/vnd.ms-excel";

    return await indexTextDocument({
      companyId,
      title,
      text: excelResult.text,
      tags: enrichedTags,
      source,
      mimeType,
      chunkSize,
      overlap,
      metadata: {
        sheets: excelResult.sheets,
        sheetNames: excelResult.metadata?.sheetNames
      }
    });
  } catch (error: any) {
    console.error(`[RAG] Failed to index Excel ${title}:`, error.message);
    throw new Error(`Falha ao processar Excel: ${error.message}`);
  }
};

// Funções exportadas para uso externo
export const indexVideoDocument = indexVideoDocumentInternal;
export const indexAudioDocument = indexAudioDocumentInternal;
export const indexGifDocument = indexGifDocumentInternal;
export const indexExcelDocument = indexExcelDocumentInternal;
