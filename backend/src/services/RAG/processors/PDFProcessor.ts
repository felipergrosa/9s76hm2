import fs from "fs";
import path from "path";

/**
 * Processador de PDFs para extração de texto
 * Suporta múltiplas bibliotecas com fallback
 * 
 * Ordem de preferência:
 * 1. pdfjs-dist (mais robusto, melhor para PDFs complexos)
 * 2. pdf-parse (mais simples, bom para PDFs simples)
 * 3. OCR (pdf2pic + tesseract para PDFs escaneados)
 * 4. Fallback texto simples
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

    // Tenta diferentes métodos de extração em ordem de preferência
    // 1. pdfjs-dist (mais robusto)
    try {
      const result = await this.extractWithPdfJS(filePath);
      if (result.text && result.text.length > 50) {
        return result;
      }
    } catch (error: any) {
      console.warn("[PDFProcessor] pdfjs-dist failed:", error.message);
    }

    // 2. pdf-parse (fallback simples)
    try {
      const result = await this.extractWithPdfParse(filePath);
      if (result.text && result.text.length > 50) {
        return result;
      }
    } catch (error: any) {
      console.warn("[PDFProcessor] pdf-parse failed:", error.message);
    }

    // 3. OCR (para PDFs escaneados)
    try {
      const result = await this.extractWithOCR(filePath);
      if (result.text && result.text.length > 20) {
        return result;
      }
    } catch (error: any) {
      console.warn("[PDFProcessor] OCR failed:", error.message);
    }

    // 4. Fallback final - texto simples
    return await this.extractSimple(filePath);
  }

  /**
   * Método usando pdfjs-dist (mais robusto)
   * Melhor para PDFs com layout complexo, tabelas, múltiplas colunas
   */
  private static async extractWithPdfJS(filePath: string): Promise<PDFProcessResult> {
    try {
      // Importação dinâmica
      const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
      
      // Configura worker (necessário para Node.js)
      const pdfjsWorker = require('pdfjs-dist/legacy/build/pdf.worker.entry');
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

      const buffer = fs.readFileSync(filePath);
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true
      });

      const pdfDocument = await loadingTask.promise;
      const numPages = pdfDocument.numPages;
      
      let fullText = '';
      const metadata: any = {};

      // Extrai metadados
      try {
        const info = await pdfDocument.getMetadata();
        if (info.info) {
          metadata.title = info.info.Title;
          metadata.author = info.info.Author;
          metadata.creator = info.info.Creator;
          metadata.producer = info.info.Producer;
          metadata.creationDate = info.info.CreationDate;
          metadata.modificationDate = info.info.ModDate;
        }
      } catch {}

      // Extrai texto de cada página
      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent({
          normalizeWhitespace: true,
          disableCombineTextItems: false
        });

        // Processa itens de texto mantendo estrutura
        let pageText = '';
        let lastY = null;
        
        for (const item of textContent.items) {
          if ('str' in item) {
            // Detecta quebra de linha baseado em posição Y
            const y = item.transform?.[5];
            if (lastY !== null && Math.abs(y - lastY) > 5) {
              pageText += '\n';
            }
            pageText += item.str;
            lastY = y;
          }
        }

        fullText += pageText + '\n\n';
      }

      // Pós-processamento
      fullText = this.cleanExtractedText(fullText);

      return {
        text: fullText.trim(),
        pages: numPages,
        metadata
      };
    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND') {
        throw new Error("Biblioteca pdfjs-dist não instalada. Execute: npm install pdfjs-dist");
      }
      throw error;
    }
  }

  /**
   * Método usando pdf-parse (mais simples)
   */
  private static async extractWithPdfParse(filePath: string): Promise<PDFProcessResult> {
    try {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      
      const data = await pdfParse(buffer);
      
      return {
        text: this.cleanExtractedText(data.text || ""),
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
   * Limpa texto extraído removendo ruídos
   */
  private static cleanExtractedText(text: string): string {
    return text
      // Remove caracteres de controle exceto newlines
      .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Normaliza múltiplos espaços
      .replace(/[ \t]+/g, ' ')
      // Normaliza múltiplas newlines
      .replace(/\n{3,}/g, '\n\n')
      // Remove espaços no início/fim de linhas
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .trim();
  }

  /**
   * Método OCR usando pdf2pic + tesseract (para PDFs escaneados)
   */
  private static async extractWithOCR(filePath: string): Promise<PDFProcessResult> {
    try {
      const pdf2pic = require('pdf2pic');
      const Tesseract = require('tesseract.js');
      
      const convert = pdf2pic.fromPath(filePath, {
        density: 100,
        saveFilename: "page",
        savePath: "/tmp",
        format: "png",
        width: 600,
        height: 800
      });
      
      const results = await convert.bulk(-1);
      let fullText = "";
      
      for (const result of results) {
        if (result.path) {
          const { data: { text } } = await Tesseract.recognize(result.path, 'por+eng');
          fullText += text + "\n\n";
          
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
   * Método simples - tenta ler como texto (fallback final)
   */
  private static async extractSimple(filePath: string): Promise<PDFProcessResult> {
    try {
      const buffer = fs.readFileSync(filePath);
      const text = buffer.toString('utf8');
      
      const cleanText = text
        .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (cleanText.length < 50) {
        throw new Error("Não foi possível extrair texto suficiente do PDF");
      }
      
      return {
        text: cleanText,
        pages: 1,
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
      
      return header.startsWith('%PDF');
    } catch {
      return false;
    }
  }

  /**
   * Estima o tamanho do texto que será extraído
   */
  static async estimateTextSize(filePath: string): Promise<number> {
    try {
      const stats = fs.statSync(filePath);
      const fileSizeKB = stats.size / 1024;
      
      const estimatedChars = fileSizeKB * 300;
      
      return Math.round(estimatedChars);
    } catch {
      return 5000;
    }
  }
}
