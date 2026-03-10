import { downloadMediaMessage, proto } from "@whiskeysockets/baileys";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import logger from "../utils/logger";

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

interface DownloadMediaParams {
  message: proto.IWebMessageInfo;
  companyId: number;
  contactId: number;
  ticketId: number;
}

interface DownloadResult {
  success: boolean;
  mediaUrl?: string;
  mediaType?: string;
  fileName?: string;
  error?: string;
}

/**
 * Faz download de mídia de uma mensagem do WhatsApp
 * e salva no filesystem local
 */
export const downloadMediaFromMessage = async ({
  message,
  companyId,
  contactId,
  ticketId
}: DownloadMediaParams): Promise<DownloadResult> => {
  try {
    // Verificar se mensagem tem mídia
    const msg = message.message;
    if (!msg) {
      return { success: false, error: "Mensagem sem conteúdo" };
    }

    // Detectar tipo de mídia
    let mediaType: string | undefined;
    let mediaMessage: any;

    if (msg.imageMessage) {
      mediaType = "image";
      mediaMessage = msg.imageMessage;
    } else if (msg.videoMessage) {
      mediaType = "video";
      mediaMessage = msg.videoMessage;
    } else if (msg.audioMessage) {
      mediaType = "audio";
      mediaMessage = msg.audioMessage;
    } else if (msg.documentMessage) {
      mediaType = "document";
      mediaMessage = msg.documentMessage;
    } else if (msg.stickerMessage) {
      mediaType = "sticker";
      mediaMessage = msg.stickerMessage;
    } else if (msg.audioMessage?.ptt) {
      // Mensagem de voz (áudio PTT)
      mediaType = "audio";
      mediaMessage = msg.audioMessage;
    } else {
      // Não é mídia ou tipo não suportado
      return { success: false, error: "Mensagem não contém mídia suportada" };
    }

    // Fazer download do buffer
    logger.debug(`[DownloadMedia] Baixando ${mediaType} da mensagem ${message.key?.id}`);
    const buffer = await downloadMediaMessage(
      message as any,
      "buffer",
      {},
      {
        logger: logger as any,
        reuploadRequest: () => Promise.resolve({} as any)
      }
    );

    if (!buffer || !(buffer instanceof Buffer)) {
      return { success: false, error: "Falha ao baixar mídia do WhatsApp" };
    }

    // Determinar extensão do arquivo
    const mimetype = mediaMessage.mimetype || "application/octet-stream";
    const extension = getExtensionFromMimetype(mimetype);

    // Gerar nome do arquivo único
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = `${timestamp}-${randomSuffix}.${extension}`;

    // Criar diretório se não existir
    const publicDir = path.resolve(__dirname, "..", "..", "public");
    const companyDir = path.join(publicDir, `company${companyId}`);
    
    if (!fs.existsSync(companyDir)) {
      await mkdirAsync(companyDir, { recursive: true });
    }

    // Salvar arquivo
    const filePath = path.join(companyDir, fileName);
    await writeFileAsync(filePath, buffer);

    // Gerar URL pública
    const mediaUrl = `/public/company${companyId}/${fileName}`;

    logger.info(
      `[DownloadMedia] Mídia salva com sucesso: ${mediaUrl} ` +
      `(${buffer.length} bytes, tipo: ${mediaType})`
    );

    return {
      success: true,
      mediaUrl,
      mediaType,
      fileName
    };

  } catch (error) {
    logger.error(`[DownloadMedia] Erro ao baixar mídia: ${(error as Error)?.message}`);
    return {
      success: false,
      error: (error as Error)?.message || "Erro desconhecido ao baixar mídia"
    };
  }
};

/**
 * Determina extensão do arquivo baseado no mimetype
 */
const getExtensionFromMimetype = (mimetype: string): string => {
  const mimetypeMap: { [key: string]: string } = {
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
    "video/x-matroska": "mkv",
    "video/webm": "webm",
    
    // Áudios
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/wav": "wav",
    "audio/webm": "weba",
    "audio/aac": "aac",
    
    // Documentos
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/zip": "zip",
    "application/x-rar-compressed": "rar",
    "application/x-7z-compressed": "7z",
    "text/plain": "txt",
    "text/csv": "csv",
    
    // Outros
    "application/octet-stream": "bin"
  };

  const extension = mimetypeMap[mimetype.toLowerCase()];
  if (extension) {
    return extension;
  }

  // Fallback: extrair do mimetype (ex: "image/jpeg" -> "jpeg")
  const parts = mimetype.split("/");
  if (parts.length === 2) {
    return parts[1].toLowerCase();
  }

  return "bin";
};

/**
 * Verifica se uma mensagem contém mídia
 */
export const hasMedia = (message: proto.IWebMessageInfo): boolean => {
  const msg = message.message;
  if (!msg) return false;

  return !!(
    msg.imageMessage ||
    msg.videoMessage ||
    msg.audioMessage ||
    msg.documentMessage ||
    msg.stickerMessage
  );
};

/**
 * Retorna o tipo de mídia de uma mensagem
 */
export const getMediaType = (message: proto.IWebMessageInfo): string | null => {
  const msg = message.message;
  if (!msg) return null;

  if (msg.imageMessage) return "image";
  if (msg.videoMessage) return "video";
  if (msg.audioMessage) return "audio";
  if (msg.documentMessage) return "document";
  if (msg.stickerMessage) return "sticker";

  return null;
};
