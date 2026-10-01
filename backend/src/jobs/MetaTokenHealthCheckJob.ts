/**
 * MetaTokenHealthCheckJob.ts
 *
 * Job diário que verifica a validade dos tokens das conexões Meta
 * (Facebook Messenger / Instagram Direct) via Graph API debug_token.
 *
 * Regras:
 * - Token inválido (is_valid=false) ou expirando em <7d → status="DISCONNECTED"
 *   + alerta via logger e socket para o tenant.
 * - Conexão já DISCONNECTED nunca é reativada automaticamente — apenas log.
 * - Tokens NUNCA são logados — somente whatsappId/companyId.
 */

import axios from "axios";
import { Op } from "sequelize";
import Whatsapp from "../models/Whatsapp";
import { getIO } from "../libs/socket";
import sanitizeWhatsapp from "../helpers/sanitizeWhatsapp";
import logger from "../utils/logger";

const GRAPH = "https://graph.facebook.com/v19.0";

// Tokens expirando em menos de 7 dias já são tratados como críticos
const EXPIRING_SOON_WINDOW_SECONDS = 7 * 24 * 60 * 60;

interface DebugTokenInfo {
  is_valid: boolean;
  // expires_at=0 significa "nunca expira" na Graph API
  expires_at?: number;
}

// Notifica o frontend que a conexão mudou de status (payload sanitizado)
const emitSessionUpdate = (connection: Whatsapp): void => {
  try {
    const io = getIO();
    io.of(`/workspace-${connection.companyId}`).emit(
      `company-${connection.companyId}-whatsappSession`,
      {
        action: "update",
        session: sanitizeWhatsapp(connection)
      }
    );
  } catch (err: any) {
    logger.warn(`[MetaTokenHealth] Falha ao emitir socket p/ whatsappId=${connection.id}: ${err.message}`);
  }
};

// Consulta debug_token. O token vai somente em params da chamada HTTPS;
// erros retornados não devem propagar o token para logs.
const debugToken = async (
  token: string,
  appId: string,
  appSecret: string
): Promise<DebugTokenInfo | null> => {
  const { data } = await axios.get(`${GRAPH}/debug_token`, {
    params: {
      input_token: token,
      access_token: `${appId}|${appSecret}`
    },
    timeout: 15000
  });
  return data?.data || null;
};

export async function runMetaTokenHealthCheck(): Promise<{
  checked: number;
  disconnected: number;
  errors: number;
}> {
  // DISCONNECTED também é inspecionado — mas apenas para log, nunca reativa
  const connections = await Whatsapp.findAll({
    where: {
      channel: { [Op.in]: ["facebook", "instagram"] },
      status: { [Op.in]: ["CONNECTED", "DISCONNECTED"] }
    }
  });

  if (connections.length === 0) {
    logger.debug("[MetaTokenHealth] Nenhuma conexão Meta (facebook/instagram) para verificar");
    return { checked: 0, disconnected: 0, errors: 0 };
  }

  const result = { checked: 0, disconnected: 0, errors: 0 };
  const nowSeconds = Math.floor(Date.now() / 1000);

  for (const connection of connections) {
    const { id, companyId, status } = connection;

    // Credenciais do app: da conexão (custom) ou globais de env
    const appId = connection.metaAppId || process.env.META_APP_ID || "";
    const appSecret = connection.metaAppSecret || process.env.META_APP_SECRET || "";
    const token = connection.metaPageAccessToken || connection.facebookUserToken;

    if (!appId || !appSecret || !token) {
      logger.debug(
        `[MetaTokenHealth] whatsappId=${id} companyId=${companyId}: sem credenciais/token para verificar, pulando`
      );
      continue;
    }

    try {
      result.checked++;
      const info = await debugToken(token, appId, appSecret);

      const expiringSoon =
        !!info?.expires_at &&
        info.expires_at > 0 &&
        info.expires_at < nowSeconds + EXPIRING_SOON_WINDOW_SECONDS;
      const invalid = !info || info.is_valid !== true || expiringSoon;

      if (invalid) {
        const reason = !info || info.is_valid !== true ? "invalid" : "expiring_soon";
        if (status === "CONNECTED") {
          await connection.update({ status: "DISCONNECTED" });
          result.disconnected++;
          // Nunca logar o token — apenas identificadores da conexão
          logger.warn(
            `[MetaTokenHealth] Token Meta ${reason} — conexão desconectada ` +
              `(whatsappId=${id} companyId=${companyId})`
          );
          emitSessionUpdate(connection);
        } else {
          logger.debug(
            `[MetaTokenHealth] whatsappId=${id} companyId=${companyId}: token ${reason}, conexão já DISCONNECTED`
          );
        }
        continue;
      }

      // Token válido: NÃO reativa conexão desconectada (reativação é manual,
      // via nova autorização OAuth na tela de conexões)
      if (status === "DISCONNECTED") {
        logger.info(
          `[MetaTokenHealth] whatsappId=${id} companyId=${companyId}: token voltou a ser válido, ` +
            "mas conexão permanece DISCONNECTED (reativação manual necessária)"
        );
      }
    } catch (err: any) {
      result.errors++;
      // Extrai apenas a mensagem da Meta (não inclui token nem URL completa)
      const metaMsg = err?.response?.data?.error?.message || err.message;
      logger.warn(
        `[MetaTokenHealth] Falha ao verificar token whatsappId=${id} companyId=${companyId}: ${metaMsg}`
      );
    }
  }

  logger.info(
    `[MetaTokenHealth] Verificação concluída: ${result.checked} checadas, ` +
      `${result.disconnected} desconectadas, ${result.errors} erros`
  );
  return result;
}

export default runMetaTokenHealthCheck;
