import axios from "axios";
import fs from "fs";
import path from "path";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
import logger from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";
import * as Sentry from "@sentry/node";
import { generatePdfThumbnail } from "../../helpers/PdfThumbnailGenerator";
import { officialApiVersion } from "../../libs/whatsapp/officialApiVersion";

const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

function isTrustedMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "graph.facebook.com" ||
        url.hostname === "lookaside.fbsbx.com" ||
        url.hostname.endsWith(".fbcdn.net") ||
        url.hostname.endsWith(".fbsbx.com"));
  } catch {
    return false;
  }
}

interface DownloadMediaOptions {
  mediaId: string;
  whatsapp: Whatsapp;
  companyId: number;
  contactId: number;
  mediaType: "image" | "video" | "audio" | "document" | "sticker";
}

/**
 * Baixa mídia da WhatsApp Official API e salva localmente
 * 
 * Fluxo:
 * 1. Obtém URL da mídia (exige accessToken)
 * 2. Baixa o arquivo
 * 3. Salva em /public/companyX/contactY/
 * 4. Retorna URL local
 * 
 * @returns URL local da mídia (ex: contact123/abc123.jpg)
 */
export const DownloadOfficialMediaService = async ({
  mediaId,
  whatsapp,
  companyId,
  contactId,
  mediaType
}: DownloadMediaOptions): Promise<string> => {
  try {
    logger.info(`[DownloadOfficialMedia] Baixando mídia ${mediaId} (${mediaType})`);

    const accessToken = whatsapp.wabaAccessToken;
    
    if (!accessToken) {
      throw new Error("Access token não configurado");
    }

    // 1. Obter informações da mídia (URL + MIME type)
    const mediaInfoResponse = await axios.get(
      `https://graph.facebook.com/${officialApiVersion()}/${encodeURIComponent(mediaId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        timeout: 30000
      }
    );

    const mediaUrl = mediaInfoResponse.data.url;
    const mimeType = mediaInfoResponse.data.mime_type;
    const fileSize = mediaInfoResponse.data.file_size;
    if (!isTrustedMediaUrl(mediaUrl) || (fileSize && fileSize > MAX_MEDIA_BYTES)) {
      throw new Error("URL ou tamanho de mídia inválido");
    }
    
    logger.debug(`[DownloadOfficialMedia] MIME: ${mimeType}, Size: ${fileSize} bytes`);

    // 2. Baixar arquivo binário
    const mediaResponse = await axios.get(mediaUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      responseType: "stream",
      timeout: 60000, // 60 segundos para download
      maxRedirects: 0
    });

    // 3. Determinar extensão do arquivo
    const ext = getExtensionFromMimeType(mimeType) || getDefaultExtension(mediaType);
    const timestamp = Date.now();
    const safeMediaId = String(mediaId).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 100);
    if (!safeMediaId) throw new Error("ID de mídia inválido");
    const filename = `${safeMediaId}-${timestamp}.${ext}`;

    // 4. Criar pasta por contato se não existir
    const publicDir = path.join(
      process.cwd(),
      "public",
      `company${companyId}`,
      `contact${contactId}`
    );

    await fs.promises.mkdir(publicDir, { recursive: true });

    // 5. Salvar arquivo
    const filePath = path.join(publicDir, filename);
    let receivedBytes = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_MEDIA_BYTES) callback(new Error("Mídia excede 50 MB"));
        else callback(null, chunk);
      }
    });
    try {
      await pipeline(mediaResponse.data, limiter, fs.createWriteStream(filePath, { flags: "wx" }));
    } catch (error) {
      await fs.promises.unlink(filePath).catch(() => undefined);
      throw error;
    }

    logger.info(`[DownloadOfficialMedia] Mídia salva: ${filename} (${(receivedBytes / 1024).toFixed(2)} KB)`);

    // 6. Gerar thumbnail da primeira página para PDFs
    try {
      if (mimeType === "application/pdf") {
        await generatePdfThumbnail(filePath);
      }
    } catch (thumbErr: any) {
      logger.warn(`[DownloadOfficialMedia] Falha ao gerar thumbnail PDF: ${thumbErr?.message}`);
    }

    // 7. Retornar apenas o caminho relativo (contact123/arquivo.ext)
    const publicUrl = `contact${contactId}/${filename}`;
    
    return publicUrl;

  } catch (error: any) {
    Sentry.captureException(error);
    
    const errorMsg = error.response?.data?.error?.message || error.message;
    logger.error(`[DownloadOfficialMedia] Erro ao baixar ${mediaId}: ${errorMsg}`);
    
    // Re-lançar erro para tratamento acima
    throw new Error(`Falha ao baixar mídia: ${errorMsg}`);
  }
};

/**
 * Mapeia MIME types para extensões de arquivo
 */
function getExtensionFromMimeType(mimeType: string): string | null {
  const map: Record<string, string> = {
    // Imagens
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/svg+xml": "svg",
    
    // Vídeos
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "video/quicktime": "mov",
    "video/x-msvideo": "avi",
    "video/webm": "webm",
    
    // Áudios
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/aac": "aac",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mp4": "m4a",
    
    // Documentos
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "text/plain": "txt",
    "text/csv": "csv",
    "application/zip": "zip",
    "application/x-rar-compressed": "rar",
    "application/x-7z-compressed": "7z",
  };

  return map[mimeType] || null;
}

/**
 * Retorna extensão padrão para cada tipo de mídia
 */
function getDefaultExtension(mediaType: string): string {
  const defaults: Record<string, string> = {
    image: "jpg",
    video: "mp4",
    audio: "mp3",
    document: "pdf"
  };

  return defaults[mediaType] || "bin";
}

export default DownloadOfficialMediaService;
