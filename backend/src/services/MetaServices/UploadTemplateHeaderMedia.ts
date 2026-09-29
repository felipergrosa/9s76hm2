import axios from "axios";
import AppError from "../../errors/AppError";
import logger from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";
import { officialApiVersion } from "../../libs/whatsapp/officialApiVersion";
import { getMetaAppId, throwMetaError } from "./metaApiClient";

interface UploadTemplateHeaderMediaParams {
  whatsapp: Whatsapp;
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
}

/**
 * Whitelist de tipos aceitos pela Resumable Upload API para
 * header de template + limites de tamanho por tipo (doc oficial):
 * - imagens (jpeg/jpg/png): até 5MB
 * - vídeo (mp4): até 16MB
 * - documento (pdf): até 100MB
 */
const MIME_RULES: Record<string, { label: string; maxBytes: number }> = {
  "image/jpeg": { label: "imagem JPEG", maxBytes: 5 * 1024 * 1024 },
  "image/jpg": { label: "imagem JPG", maxBytes: 5 * 1024 * 1024 },
  "image/png": { label: "imagem PNG", maxBytes: 5 * 1024 * 1024 },
  "video/mp4": { label: "vídeo MP4", maxBytes: 16 * 1024 * 1024 },
  "application/pdf": { label: "documento PDF", maxBytes: 100 * 1024 * 1024 }
};

const formatBytes = (bytes: number): string =>
  `${(bytes / (1024 * 1024)).toFixed(1)}MB`;

/**
 * Faz upload de mídia para uso em HEADER de template via
 * Resumable Upload API da Meta (2 etapas):
 *
 * 1) POST /{appId}/uploads?file_name&file_length&file_type&access_token
 *    → cria sessão de upload, retorna { id: "upload:..." }
 * 2) POST /upload:{sessionId} (headers: Authorization OAuth <token>,
 *    file_offset: 0, Content-Type: application/octet-stream; body = binário)
 *    → retorna { h: "4::..." } — o handle usado em example.header_handle
 *
 * Retorna o handle `h` para montar o componente:
 * { type:"HEADER", format:"IMAGE|VIDEO|DOCUMENT", example:{ header_handle:[h] } }
 */
const UploadTemplateHeaderMedia = async ({
  whatsapp,
  fileBuffer,
  fileName,
  mimeType
}: UploadTemplateHeaderMediaParams): Promise<string> => {
  const context = "UploadTemplateHeaderMedia";

  if (!whatsapp || whatsapp.channelType !== "official") {
    throw new AppError("Conexão não é do tipo API Oficial (Meta)", 400);
  }

  const accessToken = whatsapp.wabaAccessToken;
  if (!accessToken) {
    throw new AppError("Conexão oficial sem wabaAccessToken", 400);
  }

  if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new AppError("Arquivo vazio ou inválido", 400);
  }

  const normalizedMime = (mimeType || "").toLowerCase().trim();
  const rule = MIME_RULES[normalizedMime];

  if (!rule) {
    throw new AppError(
      `Tipo de arquivo não suportado: "${mimeType}". ` +
        `Aceitos: ${Object.keys(MIME_RULES).join(", ")}`,
      400
    );
  }

  if (fileBuffer.length > rule.maxBytes) {
    throw new AppError(
      `${rule.label} excede o limite de ${formatBytes(rule.maxBytes)} ` +
        `(arquivo: ${formatBytes(fileBuffer.length)})`,
      400
    );
  }

  const appId = getMetaAppId();
  const apiVersion = officialApiVersion();
  const graphBase = `https://graph.facebook.com/${apiVersion}`;

  try {
    // Etapa 1: cria a sessão de upload
    logger.info(
      `[${context}] Iniciando sessão de upload: ${fileName} ` +
        `(${normalizedMime}, ${formatBytes(fileBuffer.length)})`
    );

    const { data: session } = await axios.post(
      `${graphBase}/${appId}/uploads`,
      null,
      {
        params: {
          file_name: fileName,
          file_length: fileBuffer.length,
          file_type: normalizedMime,
          access_token: accessToken
        },
        timeout: 30000
      }
    );

    const sessionId: string | undefined = session?.id;
    if (!sessionId) {
      throw new AppError("Meta não retornou id da sessão de upload", 502);
    }

    // A resposta já vem com prefixo "upload:"; garante formato correto
    const uploadPath = sessionId.startsWith("upload:")
      ? sessionId
      : `upload:${sessionId}`;

    // Etapa 2: envia o binário da sessão criada
    const { data: uploaded } = await axios.post(
      `${graphBase}/${uploadPath}`,
      fileBuffer,
      {
        headers: {
          Authorization: `OAuth ${accessToken}`,
          file_offset: "0",
          "Content-Type": "application/octet-stream"
        },
        timeout: 60000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );

    const handle: string | undefined = uploaded?.h;
    if (!handle) {
      throw new AppError("Meta não retornou o handle da mídia (campo h)", 502);
    }

    logger.info(
      `[${context}] Upload concluído: ${fileName} → handle recebido`
    );

    return handle;
  } catch (error: any) {
    return throwMetaError(context, error);
  }
};

export default UploadTemplateHeaderMedia;
