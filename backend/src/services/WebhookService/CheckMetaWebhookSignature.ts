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

/** Every phone number claimed by a WhatsApp webhook must belong to a
 * connection whose own App Secret signed the exact raw payload. */
export async function checkOfficialWebhookSignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
  phoneNumberIds: string[]
): Promise<boolean> {
  if (!rawBody || !signatureHeader || !phoneNumberIds.length || phoneNumberIds.length > 100) {
    return false;
  }

  const ids = Array.from(new Set(phoneNumberIds));
  const connections = await Whatsapp.findAll({
    where: { channelType: "official", wabaPhoneNumberId: { [Op.in]: ids } },
    attributes: ["id", "wabaPhoneNumberId", "metaAppSecret"]
  });
  // dedup por phone id: rows duplicadas não podem derrubar a verificação,
  // e um id desconhecido continua sendo detectado pelo conjunto coberto
  const coveredIds = new Set(connections.map(c => c.wabaPhoneNumberId));
  if (coveredIds.size !== ids.length) return false;

  const globalSecret = process.env.META_APP_SECRET;
  // Se nenhum secret está configurado (nem global nem por conexão), verificar
  // é impossível — enforce total viraria outage silenciosa no deploy. Aceita
  // com warning alto para incentivar a configuração.
  const anySecret = Boolean(globalSecret) || connections.some(c => c.metaAppSecret);
  if (!anySecret) {
    logger.warn(
      "[Webhook] Assinatura NÃO verificada — configure META_APP_SECRET ou metaAppSecret por conexão"
    );
    return true;
  }

  return ids.every(id => {
    const connection = connections.find(item => item.wabaPhoneNumberId === id);
    return isValidMetaSignature(rawBody, signatureHeader, connection?.metaAppSecret || globalSecret);
  });
}
