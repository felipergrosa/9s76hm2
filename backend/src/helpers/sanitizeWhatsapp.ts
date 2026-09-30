import Whatsapp from "../models/Whatsapp";

// Campos sensíveis que nunca podem sair em respostas HTTP nem emits de socket.
// Uso interno (wbot, Baileys, Meta API) continua lendo esses campos do model —
// aqui só sanitizamos a representação serializada que vai para o cliente.
const SECRET_FIELDS = [
  "token",
  "session",
  "wabaAccessToken",
  "wabaTwoFactorPin",
  "wabaWebhookVerifyToken",
  "tokenMeta",
  "facebookUserToken",
  "metaAppSecret",
  "metaAccessToken",
  "metaPageAccessToken",
  "metaWebhookVerifyToken"
] as const;

/**
 * Serializa uma conexão WhatsApp removendo segredos/tokens.
 * Aceita instância Sequelize ou objeto plano.
 */
export const sanitizeWhatsapp = (whatsapp: Whatsapp | any): any => {
  if (!whatsapp) return whatsapp;

  const plain =
    typeof whatsapp.get === "function"
      ? whatsapp.get({ plain: true })
      : { ...whatsapp };

  for (const field of SECRET_FIELDS) {
    delete plain[field];
  }

  return plain;
};

export default sanitizeWhatsapp;
