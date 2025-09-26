import sequelize from "../../database";
import KnowledgeDocument from "../../models/KnowledgeDocument";
import KnowledgeChunk from "../../models/KnowledgeChunk";
import { splitIntoChunks } from "./ChunkUtils";
import { embedTexts } from "./EmbeddingService";
import PDFProcessor from "./processors/PDFProcessor";
import ImageProcessor from "./processors/ImageProcessor";
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
}

export interface IndexResult {
  documentId: number;
  chunks: number;
}

export const indexTextDocument = async (params: IndexTextParams): Promise<IndexResult> => {
  const { companyId, title, text, tags = [], source, mimeType, chunkSize, overlap } = params;
  if (!text || !title) throw new Error("title e text são obrigatórios");

  const chunks = splitIntoChunks(text, { chunkSize, overlap });
  if (!chunks.length) throw new Error("Nenhum conteúdo válido para indexar");

  const embeddings = await embedTexts(companyId, chunks);

  const now = new Date();
  const doc = await KnowledgeDocument.create({
    companyId,
    title,
    source,
    mimeType,
    size: text.length,
    tags: JSON.stringify(tags),
    createdAt: now,
    updatedAt: now,
  } as any);

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
    { replacements }
  );

  return { documentId: doc.id, chunks: chunks.length };
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
}): Promise<IndexResult> => {
  const { filePath } = params;
  const ext = path.extname(filePath).toLowerCase();
  
  console.log(`[RAG] Auto-indexing file: ${path.basename(filePath)} (${ext})`);

  // PDFs
  if (ext === '.pdf') {
    return await indexPDFDocument(params);
  }
  
  // Imagens
  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'].includes(ext)) {
    return await indexImageDocument(params);
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
