import * as fs from "fs";
import * as path from "path";
import logger from "../utils/logger";

/**
 * Gera thumbnail da primeira página do PDF usando pdfjs-dist (modo SVG) + sharp.
 * Não requer canvas nativo (binários pesados), apenas pdfjs-dist puro.
 */
export async function generatePdfThumbnail(pdfPath: string): Promise<string | null> {
  const dir = path.dirname(pdfPath);
  const baseName = path.basename(pdfPath, path.extname(pdfPath));
  const thumbPath = path.join(dir, `${baseName}-thumb.png`);

  if (fs.existsSync(thumbPath)) {
    return thumbPath;
  }

  logger.info(`[PdfThumbnail] Gerando thumbnail para: ${path.basename(pdfPath)}`);

  // Tentativa 1: pdfjs-dist + svg + sharp (leve, sem canvas nativo)
  try {
    logger.info(`[PdfThumbnail] Iniciando modo SVG...`);
    
    // pdfjs-dist v5 é ESM puro — usar dynamic import
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as any);
    logger.info(`[PdfThumbnail] pdfjs-lib carregado, versão: ${pdfjsLib?.version || 'unknown'}`);

    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfData = new Uint8Array(pdfBuffer);
    logger.info(`[PdfThumbnail] PDF carregado: ${pdfBuffer.length} bytes`);

    const loadingTask = pdfjsLib.getDocument({
      data: pdfData,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0,
    });
    const pdfDoc = await loadingTask.promise;
    logger.info(`[PdfThumbnail] Documento PDF pronto, páginas: ${pdfDoc.numPages}`);
    
    const page = await pdfDoc.getPage(1);
    logger.info(`[PdfThumbnail] Página 1 obtida`);

    const viewport = page.getViewport({ scale: 1.0 });
    // Escala para caber em 300x420 mantendo proporção
    const scale = Math.min(300 / viewport.width, 420 / viewport.height);
    const scaledViewport = page.getViewport({ scale });

    const width = Math.floor(scaledViewport.width);
    const height = Math.floor(scaledViewport.height);
    logger.info(`[PdfThumbnail] Viewport: ${width}x${height} (scale: ${scale.toFixed(2)})`);

    // Renderizar como SVG (não precisa de canvas nativo!)
    logger.info(`[PdfThumbnail] Obtendo operator list...`);
    const svgBuilder = await page.getOperatorList();
    logger.info(`[PdfThumbnail] SVGGraphics disponível: ${!!pdfjsLib.SVGGraphics}`);
    
    const svgGfx = new pdfjsLib.SVGGraphics(page.commonObjs, page.objs);
    logger.info(`[PdfThumbnail] Renderizando SVG...`);
    
    const svgElement = await svgGfx.getSVG(svgBuilder, scaledViewport);
    logger.info(`[PdfThumbnail] SVG gerado, elemento: ${!!svgElement}`);

    // Converter SVG element para string
    const svgString = new XMLSerializer().serializeToString(svgElement);
    logger.info(`[PdfThumbnail] SVG string length: ${svgString.length}`);
    logger.info(`[PdfThumbnail] SVG string: ${svgString.substring(0, 100)}...`);

    // Usar sharp para converter SVG em PNG
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sharp = require("sharp");
    await sharp(Buffer.from(svgString), {
      density: 150, // DPI para renderização nítida
    })
      .resize(width, height, { fit: "inside" })
      .png()
      .toFile(thumbPath);

    logger.info(`[PdfThumbnail] Thumbnail real gerado (SVG mode): ${thumbPath}`);
    return thumbPath;
  } catch (err: any) {
    logger.warn(`[PdfThumbnail] pdfjs-dist SVG falhou: ${err?.message}`);
    logger.warn(`[PdfThumbnail] Stack: ${err?.stack}`);
    logger.warn(`[PdfThumbnail] SVG error details: ${err?.toString()}`);
  }

  // Fallback: placeholder SVG via sharp
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sharp = require("sharp");
    const fileName = path.basename(pdfPath, ".pdf");
    const displayName = fileName.length > 24 ? fileName.substring(0, 21) + "..." : fileName;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280">
  <rect width="200" height="280" fill="#f5f5f5" rx="4"/>
  <rect x="10" y="10" width="180" height="260" fill="white" rx="2" stroke="#e0e0e0" stroke-width="1"/>
  <rect x="60" y="60" width="80" height="100" fill="#e53935" rx="4"/>
  <text x="100" y="120" font-family="Arial" font-size="22" font-weight="bold" fill="white" text-anchor="middle">PDF</text>
  <rect x="30" y="180" width="140" height="8" fill="#e0e0e0" rx="2"/>
  <rect x="30" y="196" width="120" height="8" fill="#e0e0e0" rx="2"/>
  <rect x="30" y="212" width="100" height="8" fill="#e0e0e0" rx="2"/>
  <text x="100" y="252" font-family="Arial" font-size="10" fill="#757575" text-anchor="middle">${displayName}</text>
</svg>`;

    await sharp(Buffer.from(svg)).png().toFile(thumbPath);
    logger.info(`[PdfThumbnail] Placeholder gerado: ${thumbPath}`);
    return thumbPath;
  } catch (err: any) {
    logger.warn(`[PdfThumbnail] Fallback sharp também falhou: ${err?.message}`);
    return null;
  }
}

export default generatePdfThumbnail;
