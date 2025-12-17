import * as fs from "fs";
import * as path from "path";
import logger from "../utils/logger";

/**
 * Gera thumbnail de PDF usando pdfjs-dist + canvas (puro JavaScript, sem GraphicsMagick)
 * Usa NodeCanvasFactory para compatibilidade com node-canvas
 */
export async function generatePdfThumbnail(pdfPath: string): Promise<string | null> {
  logger.info(`[PdfThumbnail] Iniciando geração de thumbnail para: ${pdfPath}`);
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.mjs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const canvasModule = require("canvas");
    
    logger.info(`[PdfThumbnail] Dependências carregadas com sucesso`);

    // Factory customizada para node-canvas (necessária para pdfjs-dist funcionar no Node.js)
    class NodeCanvasFactory {
      create(width: number, height: number) {
        const canvas = canvasModule.createCanvas(width, height);
        const context = canvas.getContext("2d");
        return { canvas, context };
      }
      
      reset(canvasAndContext: any, width: number, height: number) {
        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
      }
      
      destroy(canvasAndContext: any) {
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
        canvasAndContext.canvas = null;
        canvasAndContext.context = null;
      }
    }

    // Ler o PDF
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfData = new Uint8Array(pdfBuffer);

    // Carregar o documento PDF com a factory customizada
    const loadingTask = pdfjsLib.getDocument({
      data: pdfData,
      canvasFactory: new NodeCanvasFactory(),
    });
    const pdfDoc = await loadingTask.promise;

    // Pegar a primeira página
    const page = await pdfDoc.getPage(1);

    // Definir escala para thumbnail (200x280 aproximadamente)
    const viewport = page.getViewport({ scale: 1.0 });
    const scale = Math.min(200 / viewport.width, 280 / viewport.height);
    const scaledViewport = page.getViewport({ scale });

    // Criar canvas usando a factory
    const canvasFactory = new NodeCanvasFactory();
    const canvasAndContext = canvasFactory.create(
      Math.floor(scaledViewport.width),
      Math.floor(scaledViewport.height)
    );

    // Renderizar a página no canvas
    const renderContext = {
      canvasContext: canvasAndContext.context,
      viewport: scaledViewport,
    };
    await page.render(renderContext).promise;

    // Gerar nome do arquivo de thumbnail
    const dir = path.dirname(pdfPath);
    const baseName = path.basename(pdfPath, path.extname(pdfPath));
    const thumbPath = path.join(dir, `${baseName}-thumb.png`);

    // Salvar como PNG
    const buffer = canvasAndContext.canvas.toBuffer("image/png");
    fs.writeFileSync(thumbPath, buffer);

    logger.info(`[PdfThumbnail] Thumbnail gerado: ${thumbPath}`);
    return thumbPath;
  } catch (error: any) {
    if (error?.code === "MODULE_NOT_FOUND" || error?.code === "ERR_MODULE_NOT_FOUND") {
      logger.warn("[PdfThumbnail] pdfjs-dist ou canvas não instalado; pulando geração de thumbnail");
      return null;
    }

    logger.warn(`[PdfThumbnail] Falha ao gerar thumbnail: ${error?.message || error}`);
    return null;
  }
}

export default generatePdfThumbnail;
