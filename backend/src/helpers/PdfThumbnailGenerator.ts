import * as fs from "fs";
import * as path from "path";
import logger from "../utils/logger";

/**
 * Gera thumbnail de PDF usando pdf2pic (se GraphicsMagick disponível)
 * ou retorna null para fallback do frontend
 */
export async function generatePdfThumbnail(pdfPath: string): Promise<string | null> {
  logger.info(`[PdfThumbnail] Iniciando geração de thumbnail para: ${pdfPath}`);
  
  // Tentar com pdf2pic primeiro (requer GraphicsMagick/ImageMagick)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fromPath } = require("pdf2pic");
    
    const dir = path.dirname(pdfPath);
    const baseName = path.basename(pdfPath, path.extname(pdfPath));
    
    const options = {
      density: 100,
      saveFilename: `${baseName}-thumb`,
      savePath: dir,
      format: "png",
      width: 200,
      height: 280
    };
    
    const convert = fromPath(pdfPath, options);
    await convert(1); // Converte apenas a primeira página
    
    // pdf2pic salva como -thumb.1.png
    const thumbPath = path.join(dir, `${baseName}-thumb.1.png`);
    
    if (fs.existsSync(thumbPath)) {
      logger.info(`[PdfThumbnail] Thumbnail gerado com pdf2pic: ${thumbPath}`);
      return thumbPath;
    }
  } catch (pdf2picError: any) {
    logger.warn(`[PdfThumbnail] pdf2pic falhou (GraphicsMagick não disponível?): ${pdf2picError?.message}`);
  }
  
  // Tentar com pdfjs-dist + canvas como fallback
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.mjs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createCanvas } = require("canvas");
    
    logger.info(`[PdfThumbnail] Tentando com pdfjs-dist + canvas`);

    // Ler o PDF
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfData = new Uint8Array(pdfBuffer);

    // Carregar o documento PDF
    const loadingTask = pdfjsLib.getDocument({ 
      data: pdfData,
      useSystemFonts: true,
      disableFontFace: true,
    });
    const pdfDoc = await loadingTask.promise;

    // Pegar a primeira página
    const page = await pdfDoc.getPage(1);

    // Definir escala para thumbnail
    const viewport = page.getViewport({ scale: 1.0 });
    const scale = Math.min(200 / viewport.width, 280 / viewport.height);
    const scaledViewport = page.getViewport({ scale });

    // Criar canvas
    const width = Math.floor(scaledViewport.width);
    const height = Math.floor(scaledViewport.height);
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    
    // Fundo branco
    context.fillStyle = "white";
    context.fillRect(0, 0, width, height);

    // Renderizar a página
    await page.render({
      canvasContext: context,
      viewport: scaledViewport,
    }).promise;

    // Gerar nome do arquivo de thumbnail
    const dir = path.dirname(pdfPath);
    const baseName = path.basename(pdfPath, path.extname(pdfPath));
    const thumbPath = path.join(dir, `${baseName}-thumb.png`);

    // Salvar como PNG
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(thumbPath, buffer);

    logger.info(`[PdfThumbnail] Thumbnail gerado com pdfjs-dist: ${thumbPath}`);
    return thumbPath;
  } catch (pdfjsError: any) {
    logger.warn(`[PdfThumbnail] pdfjs-dist também falhou: ${pdfjsError?.message}`);
  }
  
  // Se ambos falharem, retornar null (frontend mostrará ícone genérico)
  logger.warn(`[PdfThumbnail] Não foi possível gerar thumbnail para: ${pdfPath}`);
  return null;
}

export default generatePdfThumbnail;
