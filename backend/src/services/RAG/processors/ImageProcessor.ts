import fs from "fs";
import path from "path";

/**
 * Processador de imagens para extração de texto via OCR
 * Útil para catálogos, screenshots, documentos escaneados
 */

export interface ImageProcessResult {
  text: string;
  confidence: number;
  metadata?: {
    width?: number;
    height?: number;
    format?: string;
    hasText?: boolean;
  };
}

export default class ImageProcessor {
  private static supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'];

  /**
   * Extrai texto de uma imagem usando OCR
   */
  static async extractText(filePath: string): Promise<ImageProcessResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo de imagem não encontrado: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!this.supportedFormats.includes(ext)) {
      throw new Error(`Formato de imagem não suportado: ${ext}`);
    }

    try {
      return await this.extractWithTesseract(filePath);
    } catch (tesseractError) {
      console.warn("[ImageProcessor] Tesseract failed, trying simple analysis:", tesseractError);
      
      // Fallback - análise básica da imagem
      return await this.analyzeBasic(filePath);
    }
  }

  /**
   * OCR usando Tesseract
   */
  private static async extractWithTesseract(filePath: string): Promise<ImageProcessResult> {
    try {
      const Tesseract = require('tesseract.js');
      
      console.log(`[ImageProcessor] Processing image: ${path.basename(filePath)}`);
      
      const { data: { text, confidence } } = await Tesseract.recognize(filePath, 'por+eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      // Limpa e valida o texto extraído
      const cleanText = text
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const metadata = await this.getImageMetadata(filePath);

      return {
        text: cleanText,
        confidence: confidence || 0,
        metadata: {
          ...metadata,
          hasText: cleanText.length > 10
        }
      };

    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND') {
        throw new Error("Biblioteca tesseract.js não instalada. Execute: npm install tesseract.js");
      }
      throw error;
    }
  }

  /**
   * Análise básica sem OCR (fallback)
   */
  private static async analyzeBasic(filePath: string): Promise<ImageProcessResult> {
    const metadata = await this.getImageMetadata(filePath);
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // Gera texto baseado no nome do arquivo e metadados
    const descriptiveText = [
      `Imagem: ${fileName}`,
      metadata.format ? `Formato: ${metadata.format}` : '',
      metadata.width && metadata.height ? `Dimensões: ${metadata.width}x${metadata.height}` : '',
      'Conteúdo visual não processado - OCR não disponível'
    ].filter(Boolean).join('. ');

    return {
      text: descriptiveText,
      confidence: 0,
      metadata: {
        ...metadata,
        hasText: false
      }
    };
  }

  /**
   * Extrai metadados básicos da imagem
   */
  private static async getImageMetadata(filePath: string): Promise<any> {
    try {
      // Tenta usar sharp se disponível
      const sharp = require('sharp');
      const metadata = await sharp(filePath).metadata();
      
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format?.toUpperCase(),
      };
    } catch {
      // Fallback - informações básicas do arquivo
      const stats = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      return {
        format: ext.substring(1).toUpperCase(),
        size: stats.size
      };
    }
  }

  /**
   * Verifica se uma imagem provavelmente contém texto
   */
  static async hasTextContent(filePath: string): Promise<boolean> {
    try {
      const result = await this.extractText(filePath);
      return result.text.length > 20 && result.confidence > 30;
    } catch {
      return false;
    }
  }

  /**
   * Processa múltiplas imagens em lote
   */
  static async processBatch(filePaths: string[]): Promise<ImageProcessResult[]> {
    const results: ImageProcessResult[] = [];
    
    for (const filePath of filePaths) {
      try {
        console.log(`[ImageProcessor] Processing ${path.basename(filePath)}...`);
        const result = await this.extractText(filePath);
        results.push(result);
      } catch (error: any) {
        console.error(`[ImageProcessor] Failed to process ${filePath}:`, error.message);
        results.push({
          text: `Erro ao processar imagem: ${path.basename(filePath)}`,
          confidence: 0,
          metadata: { hasText: false }
        });
      }
    }
    
    return results;
  }

  /**
   * Valida se um arquivo é uma imagem suportada
   */
  static isValidImage(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) return false;
      
      const ext = path.extname(filePath).toLowerCase();
      return this.supportedFormats.includes(ext);
    } catch {
      return false;
    }
  }

  /**
   * Otimiza imagem para OCR (se sharp estiver disponível)
   */
  static async optimizeForOCR(inputPath: string, outputPath?: string): Promise<string> {
    try {
      const sharp = require('sharp');
      const output = outputPath || inputPath.replace(/\.[^.]+$/, '_optimized.png');
      
      await sharp(inputPath)
        .resize(null, 1200, { withoutEnlargement: true }) // Altura máxima 1200px
        .sharpen()
        .normalize()
        .png({ quality: 90 })
        .toFile(output);
      
      return output;
    } catch {
      // Se sharp não estiver disponível, retorna o arquivo original
      return inputPath;
    }
  }
}
