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
  "metaWebhookVerifyToken",
  "proxyUrl",
  // Token do webchat público: bearer credential da URL /webchat/:token.
  // Só é entregue via POST /whatsapp/:id/webchat-token (connections.edit).
  "webchatToken",
  // Credenciais do canal Telegram: botToken é segredo do BotFather;
  // webhookToken é bearer credential da URL /public/telegram/:token.
  "telegramBotToken",
  "telegramWebhookToken"
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
