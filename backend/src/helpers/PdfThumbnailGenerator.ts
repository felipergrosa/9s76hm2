import * as fs from "fs";
import * as path from "path";
import logger from "../utils/logger";

/**
 * Gera thumbnail de PDF usando pdfjs-dist + canvas (puro JavaScript, sem GraphicsMagick)
 */
export async function generatePdfThumbnail(pdfPath: string): Promise<string | null> {
  logger.info(`[PdfThumbnail] Iniciando geração de thumbnail para: ${pdfPath}`);
  
  try {
    // Imports dinâmicos usando require para compatibilidade com ambiente compilado
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.mjs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createCanvas } = require("canvas");
    
    logger.info(`[PdfThumbnail] Dependências carregadas com sucesso`);

    // Ler o PDF
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfData = new Uint8Array(pdfBuffer);

    // Carregar o documento PDF
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdfDoc = await loadingTask.promise;

    // Pegar a primeira página
    const page = await pdfDoc.getPage(1);

    // Definir escala para thumbnail (200x280 aproximadamente)
    const viewport = page.getViewport({ scale: 1.0 });
    const scale = Math.min(200 / viewport.width, 280 / viewport.height);
    const scaledViewport = page.getViewport({ scale });

    // Criar canvas
    const canvas = createCanvas(scaledViewport.width, scaledViewport.height);
    const context = canvas.getContext("2d");

    // Renderizar a página no canvas
    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport,
      canvas: canvas
    };
    await page.render(renderContext as any).promise;

    // Gerar nome do arquivo de thumbnail
    const dir = path.dirname(pdfPath);
    const baseName = path.basename(pdfPath, path.extname(pdfPath));
    // Gerar como -thumb.png (formato esperado pelo frontend)
    const thumbPath = path.join(dir, `${baseName}-thumb.png`);

    // Salvar como PNG
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(thumbPath, buffer);

    logger.info(`[PdfThumbnail] Thumbnail gerado: ${thumbPath}`);
    return thumbPath;
  } catch (error: any) {
    // Se as dependências não estiverem instaladas, apenas logar aviso
    if (error?.code === "MODULE_NOT_FOUND" || error?.code === "ERR_MODULE_NOT_FOUND") {
      logger.warn("[PdfThumbnail] pdfjs-dist ou canvas não instalado; pulando geração de thumbnail");
      return null;
    }

    // Outros erros
    logger.warn(`[PdfThumbnail] Falha ao gerar thumbnail: ${error?.message || error}`);
    return null;
  }
}

export default generatePdfThumbnail;
