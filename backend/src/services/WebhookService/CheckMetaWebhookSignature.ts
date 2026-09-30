import { Op } from "sequelize";
import Whatsapp from "../../models/Whatsapp";
import { isValidMetaSignature } from "../../helpers/VerifyMetaWebhookSignature";
import logger from "../../utils/logger";

/**
 * Política de verificação de assinatura HMAC (X-Hub-Signature-256) — fail-closed:
 * - Quando existe secret configurado (META_APP_SECRET global ou metaAppSecret
 *   por conexão), a assinatura é SEMPRE verificada e payload inválido é rejeitado.
 * - Quando NENHUM secret está configurado é impossível verificar: em produção
 *   (NODE_ENV=production) o evento é rejeitado; fora de produção aceita com
 *   warning (dev/teste local sem app Meta configurado).
 */

// Log de boot: em produção sem secret global, só passam webhooks de conexões
// que tenham metaAppSecret próprio — deixar isso explícito desde o start.
if (process.env.NODE_ENV === "production" && !process.env.META_APP_SECRET) {
  logger.warn(
    "[Webhook] META_APP_SECRET não configurado: webhooks só serão aceitos para " +
    "conexões com metaAppSecret próprio; demais eventos serão rejeitados (fail-closed)."
  );
}

// Garante que o erro de "sem secret em produção" seja logado apenas uma vez
let secretlessRejectLogged = false;
const logSecretlessRejectOnce = (label: string): void => {
  if (secretlessRejectLogged) return;
  secretlessRejectLogged = true;
  logger.error(
    `[Webhook][${label}] Rejeitando evento sem verificação: nenhum secret configurado ` +
    "(META_APP_SECRET ou metaAppSecret por conexão) em produção"
  );
};

/**
 * Valida a assinatura HMAC (X-Hub-Signature-256) de um webhook da Meta.
 * Tenta primeiro o App Secret global (META_APP_SECRET) e, se não validar,
 * cai para os App Secrets configurados por conexão (multi-app por empresa).
 *
 * Retorna false quando a assinatura é inválida/ausente havendo secret
 * configurado, ou quando não há nenhum secret e o ambiente é produção.
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

  const anySecret = Boolean(globalSecret) || connectionsWithSecret.length > 0;
  if (!anySecret) {
    if (process.env.NODE_ENV === "production") {
      logSecretlessRejectOnce(label);
      return false;
    }
    logger.warn(
      `[Webhook][${label}] Assinatura NÃO verificada — configure META_APP_SECRET ou metaAppSecret por conexão`
    );
    return true;
  }

  logger.warn(`[Webhook][${label}] Assinatura HMAC inválida ou ausente`);
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
  // Sem nenhum secret (nem global nem por conexão) verificar é impossível.
  // Fail-closed: em produção rejeita; fora de produção aceita com warning
  // para permitir desenvolvimento/teste local sem app Meta.
  const anySecret = Boolean(globalSecret) || connections.some(c => c.metaAppSecret);
  if (!anySecret) {
    if (process.env.NODE_ENV === "production") {
      logSecretlessRejectOnce("whatsapp-official");
      return false;
    }
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
