import { Op } from "sequelize";
import Whatsapp from "../../models/Whatsapp";
import User from "../../models/User";
import logger from "../../utils/logger";
import { extractMetaError, getMetaAxiosClient } from "./metaApiClient";

// Campos consultados no nó phone_number da Graph API.
// `status` = status da linha na Meta (CONNECTED etc.),
// `quality_rating` = GREEN/YELLOW/RED (objeto {score} em versões novas),
// `messaging_limit_tier` = TIER_50/250/1K/10K/100K/UNLIMITED,
// `name_status` = status do nome de exibição (APPROVED/PENDING_REVIEW/...).
const PHONE_NUMBER_FIELDS = [
  "id",
  "display_phone_number",
  "verified_name",
  "status",
  "quality_rating",
  "name_status",
  "messaging_limit_tier",
  "code_verification_status",
  "platform_type",
  "throughput"
].join(",");

export interface WhatsappHealthItem {
  id: number;
  name: string;
  number: string | null;
  status: string; // status local (banco)
  metaStatus: string | null; // status reportado pela Meta
  verifiedName: string | null;
  qualityRating: string | null; // GREEN | YELLOW | RED | NA
  messagingLimit: string | null; // TIER_* retornado pela Meta
  nameStatus: string | null;
  codeVerificationStatus: string | null;
  platformType: string | null;
  throughput: string | null; // nível de throughput (STANDARD/HIGH...)
  lastSync: string | null; // ISO do momento da consulta à Meta
  error: string | null; // erro da Graph API isolado por linha
}

export interface WhatsappHealthResult {
  items: WhatsappHealthItem[];
  stats: {
    total: number;
    connected: number;
    green: number;
    attention: number; // YELLOW + RED
    errors: number; // linhas com falha na consulta à Meta
  };
  syncedAt: string;
}

interface ListParams {
  companyId: number;
  userId: number;
}

/**
 * Normaliza quality_rating: versões antigas retornam string ("GREEN"),
 * versões recentes podem retornar objeto ({ score: "GREEN" }).
 */
const normalizeQualityRating = (raw: any): string | null => {
  if (!raw) return null;
  if (typeof raw === "string") return raw.toUpperCase();
  if (typeof raw === "object" && typeof raw.score === "string") {
    return raw.score.toUpperCase();
  }
  return null;
};

const normalizeThroughput = (raw: any): string | null => {
  if (!raw || typeof raw !== "object") return null;
  return typeof raw.level === "string" ? raw.level : null;
};

/**
 * Consulta a Graph API para um número WABA e monta a linha de saúde.
 * Qualquer falha (token expirado, permissão, timeout) vira `error` na
 * linha — nunca propaga exceção para a rota.
 */
const fetchPhoneNumberHealth = async (
  whatsapp: Whatsapp
): Promise<WhatsappHealthItem> => {
  const item: WhatsappHealthItem = {
    id: whatsapp.id,
    name: whatsapp.name,
    number: whatsapp.number || null,
    status: whatsapp.status,
    metaStatus: null,
    verifiedName: null,
    qualityRating: null,
    messagingLimit: null,
    nameStatus: null,
    codeVerificationStatus: null,
    platformType: null,
    throughput: null,
    lastSync: null,
    error: null
  };

  // Credenciais incompletas: conexão oficial sem dados de WABA
  if (!whatsapp.wabaPhoneNumberId || !whatsapp.wabaAccessToken) {
    item.error = "Credenciais Meta incompletas (phoneNumberId/accessToken ausentes)";
    return item;
  }

  try {
    const client = getMetaAxiosClient(whatsapp);
    const { data } = await client.get(`/${whatsapp.wabaPhoneNumberId}`, {
      params: { fields: PHONE_NUMBER_FIELDS }
    });

    item.metaStatus = data?.status || null;
    item.verifiedName = data?.verified_name || null;
    item.qualityRating = normalizeQualityRating(data?.quality_rating);
    item.messagingLimit = data?.messaging_limit_tier || null;
    item.nameStatus = data?.name_status || null;
    item.codeVerificationStatus = data?.code_verification_status || null;
    item.platformType = data?.platform_type || null;
    item.throughput = normalizeThroughput(data?.throughput);
    // Número exibido na Meta tem precedência sobre o gravado localmente
    item.number = data?.display_phone_number || item.number;
    item.lastSync = new Date().toISOString();
  } catch (err: any) {
    // Erro isolado por número (token expirado, sem escopo, timeout...)
    // Nunca logar token nem payload — só metadados do erro.
    const meta = extractMetaError(err);
    item.error = meta.userMessage || meta.message;
    item.lastSync = new Date().toISOString();
    logger.warn(
      `[WhatsappHealth] Falha ao consultar número da conexão ${whatsapp.id} ` +
      `(status HTTP ${err?.response?.status || "n/a"}, code ${meta.code ?? "n/a"}): ${meta.message}`
    );
  }

  return item;
};

/**
 * Lista a saúde (qualidade, limite, nome) de todas as conexões
 * WhatsApp API Oficial (channelType=official) da empresa.
 * Respeita allowedConnectionIds do usuário, igual à listagem de conexões.
 */
const ListWhatsappHealthService = async ({
  companyId,
  userId
}: ListParams): Promise<WhatsappHealthResult> => {
  const where: any = {
    companyId,
    channelType: "official"
  };

  // Usuário não-super enxerga apenas as conexões permitidas a ele
  const user = await User.findByPk(userId, {
    attributes: ["id", "super", "allowedConnectionIds"]
  });
  const allowedIds = user?.allowedConnectionIds || [];
  if (user && !user.super && allowedIds.length > 0) {
    where.id = { [Op.in]: allowedIds };
  }

  const whatsapps = await Whatsapp.findAll({
    where,
    attributes: [
      "id",
      "name",
      "number",
      "status",
      "wabaPhoneNumberId",
      "wabaAccessToken",
      "wabaBusinessAccountId",
      "channelType",
      "companyId"
    ],
    order: [["name", "ASC"]]
  });

  // Consulta em paralelo — volume por empresa é pequeno e cada chamada
  // tem timeout próprio no client (30s).
  const items = await Promise.all(whatsapps.map(fetchPhoneNumberHealth));

  const stats = {
    total: items.length,
    connected: items.filter(i => i.status === "CONNECTED").length,
    green: items.filter(i => i.qualityRating === "GREEN").length,
    attention: items.filter(
      i => i.qualityRating === "YELLOW" || i.qualityRating === "RED"
    ).length,
    errors: items.filter(i => !!i.error).length
  };

  return { items, stats, syncedAt: new Date().toISOString() };
};

export default ListWhatsappHealthService;
