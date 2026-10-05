import * as fs from "fs";
import * as path from "path";
import logger from "../utils/logger";

// NOTA: não misturar o pacote `canvas` com o pdfjs — os Path2D/DOMMatrix
// internos do pdfjs vêm de @napi-rs/canvas. O canvas de saída deve ser
// criado via `doc.canvasFactory` (NodeCanvasFactory do pdfjs).

/**
 * Renderiza a primeira página do PDF em um canvas (pdfjs-dist + node-canvas)
 * e retorna o buffer PNG junto com as dimensões. Retorna null em falha.
 */
async function renderPdfFirstPage(
  pdfPath: string,
  maxWidth = 300,
  maxHeight = 420
): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  // pdfjs-dist v5 é ESM puro — usar dynamic import
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as any);

  // Em Node, o pdfjs precisa dos dados de fontes/cmaps/wasm empacotados
  // para rasterizar texto e conteúdo — sem eles a página sai em branco.
  const pdfjsDir = path
    .dirname(require.resolve("pdfjs-dist/package.json"))
    .replace(/\\/g, "/");

  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfDoc = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    isEvalSupported: false,
    disableFontFace: true,
    standardFontDataUrl: `${pdfjsDir}/standard_fonts/`,
    cMapUrl: `${pdfjsDir}/cmaps/`,
    cMapPacked: true,
    wasmUrl: `${pdfjsDir}/wasm/`,
    verbosity: 0,
  }).promise;

  try {
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 1.0 });
    const scale = Math.min(maxWidth / viewport.width, maxHeight / viewport.height);
    const scaledViewport = page.getViewport({ scale });

    const pair = (pdfDoc as any).canvasFactory.create(
      scaledViewport.width,
      scaledViewport.height
    );

    await page.render({
      canvasContext: pair.context,
      viewport: scaledViewport,
      canvasFactory: (pdfDoc as any).canvasFactory,
      background: "#ffffff",
    }).promise;

    // @napi-rs/canvas expõe encode() (async); node-canvas, toBuffer()
    const buffer: Buffer = pair.canvas.encode
      ? await pair.canvas.encode("png")
      : pair.canvas.toBuffer("image/png");
    return {
      buffer,
      width: Math.ceil(scaledViewport.width),
      height: Math.ceil(scaledViewport.height),
    };
  } finally {
    try {
      await pdfDoc.destroy();
    } catch { }
  }
}

/**
 * Gera thumbnail da primeira página do PDF e salva em disco como
 * `<nome>-thumb.png` (convenção consumida pelo frontend em MessagesList).
 * Retorna o caminho do arquivo ou null em falha.
 */
export async function generatePdfThumbnail(pdfPath: string): Promise<string | null> {
  const dir = path.dirname(pdfPath);
  const baseName = path.basename(pdfPath, path.extname(pdfPath));
  const thumbPath = path.join(dir, `${baseName}-thumb.png`);

  if (fs.existsSync(thumbPath)) {
    return thumbPath;
  }

  try {
    const rendered = await renderPdfFirstPage(pdfPath);
    if (rendered) {
      fs.writeFileSync(thumbPath, rendered.buffer);
      logger.info(`[PdfThumbnail] Thumbnail gerado: ${thumbPath}`);
      return thumbPath;
    }
  } catch (err: any) {
    logger.warn(`[PdfThumbnail] Render pdfjs/canvas falhou: ${err?.message}`);
  }

  // Fallback: placeholder SVG via sharp (nunca bloqueia o envio)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sharp = require("sharp");
    const fileName = path.basename(pdfPath, ".pdf");
    const displayName = fileName.length > 24 ? `${fileName.substring(0, 21)}...` : fileName;

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

/**
 * Retorna a thumbnail da primeira página do PDF como Buffer JPEG,
 * no formato esperado pelo campo `jpegThumbnail` do Baileys
 * (preview exibido no balão de documento do WhatsApp).
 */
export async function getPdfJpegThumbnail(pdfPath: string): Promise<Buffer | null> {
  try {
    // Reaproveita o arquivo em disco quando já renderizado
    const dir = path.dirname(pdfPath);
    const baseName = path.basename(pdfPath, path.extname(pdfPath));
    const cachedPng = path.join(dir, `${baseName}-thumb.png`);

    let png: Buffer | null = null;
    if (fs.existsSync(cachedPng)) {
      png = fs.readFileSync(cachedPng);
    } else {
      const rendered = await renderPdfFirstPage(pdfPath);
      if (!rendered) return null;
      png = rendered.buffer;
      try {
        fs.writeFileSync(cachedPng, png);
      } catch { }
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sharp = require("sharp");
    // jpegThumbnail do WhatsApp: pequeno (~96px de largura é suficiente)
    return await sharp(png)
      .resize({ width: 96, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
  } catch (err: any) {
    logger.warn(`[PdfThumbnail] getPdfJpegThumbnail falhou: ${err?.message}`);
    return null;
  }
}

export default generatePdfThumbnail;
