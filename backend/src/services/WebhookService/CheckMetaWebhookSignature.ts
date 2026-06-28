import { Op } from "sequelize";
import Whatsapp from "../../models/Whatsapp";
import { isValidMetaSignature } from "../../helpers/VerifyMetaWebhookSignature";
import logger from "../../utils/logger";

export const WEBHOOK_SIGNATURE_ENFORCE =
  process.env.WEBHOOK_SIGNATURE_ENFORCE === "true";

/**
 * Valida a assinatura HMAC (X-Hub-Signature-256) de um webhook da Meta.
 * Tenta primeiro o App Secret global (META_APP_SECRET) e, se não validar,
 * cai para os App Secrets configurados por conexão (multi-app por empresa).
 *
 * Em modo log-only (WEBHOOK_SIGNATURE_ENFORCE != "true"), nunca bloqueia —
 * só registra um warning para permitir observar antes de aplicar enforcement.
 */
export async function checkMetaWebhookSignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
  label: string
): Promise<boolean> {
  const globalSecret = process.env.META_APP_SECRET;
  if (isValidMetaSignature(rawBody, signatureHeader, globalSecret)) {
    return true;
  }

  const connectionsWithSecret = await Whatsapp.findAll({
    where: { metaAppSecret: { [Op.ne]: null } },
    attributes: ["id", "metaAppSecret"]
  });

  const matched = connectionsWithSecret.some(connection =>
    isValidMetaSignature(rawBody, signatureHeader, connection.metaAppSecret)
  );

  if (matched) return true;

  logger.warn(
    `[Webhook][${label}] Assinatura HMAC inválida ou ausente (enforce=${WEBHOOK_SIGNATURE_ENFORCE})`
  );
  return false;
}
