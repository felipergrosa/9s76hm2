import axios, { AxiosInstance } from "axios";
import AppError from "../../errors/AppError";
import logger from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";
import { officialApiVersion } from "../../libs/whatsapp/officialApiVersion";

/**
 * Retorna um cliente Axios configurado para a Graph API da Meta
 * usando as credenciais da conexão oficial (WhatsApp Business API).
 *
 * Requer: channelType === "official", wabaAccessToken e wabaBusinessAccountId.
 * O token NUNCA é logado.
 */
export const getMetaAxiosClient = (whatsapp: Whatsapp): AxiosInstance => {
  if (!whatsapp || whatsapp.channelType !== "official") {
    throw new AppError("Conexão não é do tipo API Oficial (Meta)", 400);
  }

  const { wabaAccessToken, wabaBusinessAccountId } = whatsapp;

  if (!wabaAccessToken || !wabaBusinessAccountId) {
    throw new AppError(
      "Conexão oficial sem credenciais completas (wabaAccessToken/wabaBusinessAccountId)",
      400
    );
  }

  const apiVersion = officialApiVersion();

  return axios.create({
    baseURL: `https://graph.facebook.com/${apiVersion}`,
    headers: {
      Authorization: `Bearer ${wabaAccessToken}`,
      "Content-Type": "application/json"
    },
    timeout: 30000
  });
};

/**
 * Retorna o App ID da Meta (usado na Resumable Upload API).
 * Variáveis: META_APP_ID ou FACEBOOK_APP_ID (fallback).
 */
export const getMetaAppId = (): string => {
  const appId = process.env.META_APP_ID || process.env.FACEBOOK_APP_ID;

  if (!appId) {
    throw new AppError(
      "META_APP_ID/FACEBOOK_APP_ID não configurado no ambiente",
      503
    );
  }

  return appId;
};

interface ExtractedMetaError {
  message: string;
  code?: number;
  subcode?: number;
}

/**
 * Extrai o objeto de erro padrão da Meta:
 * error.response.data.error = { message, code, error_subcode, ... }
 */
export const extractMetaError = (error: any): ExtractedMetaError => {
  const metaError = error?.response?.data?.error;

  if (metaError && typeof metaError === "object") {
    return {
      message: metaError.message || "Erro desconhecido retornado pela Meta",
      code: typeof metaError.code === "number" ? metaError.code : undefined,
      subcode:
        typeof metaError.error_subcode === "number"
          ? metaError.error_subcode
          : undefined
    };
  }

  return { message: error?.message || "Erro desconhecido" };
};

/**
 * Padroniza erros da Graph API em AppError com mensagens pt-BR.
 * Loga apenas metadados do erro (status/code/subcode/message da Meta),
 * nunca token nem payload completo.
 */
export const throwMetaError = (context: string, error: any): never => {
  // Erros de negócio já tratados são apenas propagados
  if (error instanceof AppError) {
    throw error;
  }

  const meta = extractMetaError(error);
  const responseStatus: number | undefined = error?.response?.status;
  const httpStatus =
    responseStatus && responseStatus >= 400 && responseStatus < 500
      ? responseStatus
      : 500;

  logger.error(`[${context}] Erro na API Meta`, {
    status: responseStatus,
    code: meta.code,
    subcode: meta.subcode,
    metaMessage: meta.message
  });

  // Subcode 2388024: nome de template duplicado no mesmo idioma
  if (meta.subcode === 2388024) {
    throw new AppError(
      "Já existe um template com esse nome neste idioma.",
      409
    );
  }

  // Code 200: erro de permissão — falta scope whatsapp_business_management
  if (meta.code === 200) {
    throw new AppError(
      "Permissão insuficiente na Meta: o token precisa do escopo " +
        `whatsapp_business_management. Detalhe: ${meta.message}`,
      403
    );
  }

  if (error?.code === "ECONNABORTED") {
    throw new AppError("Tempo esgotado ao chamar a API Meta.", 504);
  }

  if (meta.message && error?.response) {
    throw new AppError(`Erro na API Meta: ${meta.message}`, httpStatus);
  }

  throw new AppError(
    `Erro inesperado ao chamar a API Meta: ${meta.message}`,
    httpStatus
  );
};
