import fs from "fs";
import path from "path";

/**
 * Processador de PDFs para extração de texto
 * Suporta múltiplas bibliotecas com fallback
 */

export interface PDFProcessResult {
  text: string;
  pages: number;
  metadata?: {
    title?: string;
    author?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
  };
}

export default class PDFProcessor {
  /**
   * Extrai texto de um arquivo PDF
   */
  static async extractText(filePath: string): Promise<PDFProcessResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo PDF não encontrado: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.pdf') {
      throw new Error(`Arquivo não é PDF: ${ext}`);
    }

    // Tenta diferentes métodos de extração
    try {
      return await this.extractWithPdfParse(filePath);
    } catch (pdfParseError) {
      console.warn("[PDFProcessor] pdf-parse failed, trying pdf2pic + OCR:", pdfParseError);
      
      try {
        return await this.extractWithOCR(filePath);
      } catch (ocrError) {
        console.warn("[PDFProcessor] OCR failed, trying simple text extraction:", ocrError);
        
        // Fallback final - texto simples se possível
        return await this.extractSimple(filePath);
      }
    }
  }

  /**
   * Método principal usando pdf-parse
   */
  private static async extractWithPdfParse(filePath: string): Promise<PDFProcessResult> {
    try {
      // Importação dinâmica para evitar erro se não estiver instalado
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      
      const data = await pdfParse(buffer);
      
      return {
        text: data.text || "",
        pages: data.numpages || 0,
        metadata: {
          title: data.info?.Title,
          author: data.info?.Author,
          creator: data.info?.Creator,
          producer: data.info?.Producer,
          creationDate: data.info?.CreationDate ? new Date(data.info.CreationDate) : undefined,
          modificationDate: data.info?.ModDate ? new Date(data.info.ModDate) : undefined
        }
      };
    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND') {
        throw new Error("Biblioteca pdf-parse não instalada. Execute: npm install pdf-parse");
      }
      throw error;
    }
  }

  /**
   * Método OCR usando pdf2pic + tesseract (para PDFs escaneados)
   */
  private static async extractWithOCR(filePath: string): Promise<PDFProcessResult> {
    try {
      // Importações dinâmicas
      const pdf2pic = require('pdf2pic');
      const Tesseract = require('tesseract.js');
      
      // Converte PDF para imagens
      const convert = pdf2pic.fromPath(filePath, {
        density: 100,
        saveFilename: "page",
        savePath: "/tmp",
        format: "png",
        width: 600,
        height: 800
      });
      
      const results = await convert.bulk(-1); // Todas as páginas
      let fullText = "";
      
      // OCR em cada página
      for (const result of results) {
        if (result.path) {
          const { data: { text } } = await Tesseract.recognize(result.path, 'por+eng');
          fullText += text + "\n\n";
          
          // Limpa arquivo temporário
          try {
            fs.unlinkSync(result.path);
          } catch {}
        }
      }
      
      return {
        text: fullText.trim(),
        pages: results.length,
        metadata: {}
      };
      
    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND') {
        throw new Error("Bibliotecas OCR não instaladas. Execute: npm install pdf2pic tesseract.js");
      }
      throw error;
    }
  }

  /**
   * Método simples - tenta ler como texto (para PDFs com texto selecionável)
   */
  private static async extractSimple(filePath: string): Promise<PDFProcessResult> {
    try {
      // Última tentativa - lê como buffer e tenta extrair strings
      const buffer = fs.readFileSync(filePath);
      const text = buffer.toString('utf8');
      
      // Remove caracteres de controle e mantém apenas texto legível
      const cleanText = text
        .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ') // Remove caracteres de controle
        .replace(/\s+/g, ' ') // Normaliza espaços
        .trim();
      
      if (cleanText.length < 50) {
        throw new Error("Não foi possível extrair texto suficiente do PDF");
      }
      
      return {
        text: cleanText,
        pages: 1, // Não conseguimos determinar páginas
        metadata: {}
      };
      
    } catch (error) {
      throw new Error(`Falha em todos os métodos de extração de PDF: ${error}`);
    }
  }

  /**
   * Valida se um arquivo é um PDF válido
   */
  static isValidPDF(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) return false;
      
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(5);
      fs.readSync(fd, buffer, 0, 5, 0);
      fs.closeSync(fd);
      const header = buffer.toString('ascii');
      
      return header === '%PDF';
    } catch {
      return false;
    }
  }

  /**
   * Estima o tamanho do texto que será extraído (para planejamento de chunks)
   */
  static async estimateTextSize(filePath: string): Promise<number> {
    try {
      const stats = fs.statSync(filePath);
      const fileSizeKB = stats.size / 1024;
      
      // Estimativa baseada no tamanho do arquivo
      // PDFs com texto: ~1KB arquivo = ~500 chars texto
      // PDFs escaneados: ~1KB arquivo = ~100 chars texto
      const estimatedChars = fileSizeKB * 300; // Média
      
      return Math.round(estimatedChars);
    } catch {
      return 5000; // Estimativa padrão
    }
  }
}
