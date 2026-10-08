import axios from "axios";

// =============================================================================
// Cliente fino da Telegram Bot API (canal "telegram" — referência Fluxoo).
// REGRA DE OURO: o botToken NUNCA é logado nem devolvido em erros — os helpers
// expõem apenas HTTP status + description da API, que não contêm o token.
// =============================================================================

const TELEGRAM_API_BASE = "https://api.telegram.org";
const DEFAULT_TIMEOUT = 15000;

const apiUrl = (botToken: string, method: string): string =>
  `${TELEGRAM_API_BASE}/bot${botToken}/${method}`;

/**
 * Mensagem de erro segura para logs: nunca inclui err.message crú do axios
 * (que embute a URL com o botToken) — só status HTTP + description da API.
 */
export const safeTelegramError = (err: any): string => {
  const status = err?.response?.status;
  const desc = err?.response?.data?.description;
  return `Telegram API falhou (status=${status ?? "n/a"}${desc ? `: ${desc}` : ""})`;
};

/** getMe — valida o token e devolve dados públicos do bot. */
export const telegramGetMe = async (botToken: string): Promise<any> => {
  const { data } = await axios.get(apiUrl(botToken, "getMe"), {
    timeout: DEFAULT_TIMEOUT
  });
  return data?.result; // { id, is_bot, first_name, username, ... }
};

/**
 * setWebhook — registra a URL pública que receberá os updates.
 * secretToken (opcional) faz o Telegram enviar o header
 * X-Telegram-Bot-Api-Secret-Token em cada update — defesa em profundidade
 * além do token na própria URL.
 */
export const telegramSetWebhook = async (
  botToken: string,
  url: string,
  secretToken?: string
): Promise<any> => {
  const payload: any = {
    url,
    allowed_updates: ["message"],
    drop_pending_updates: true
  };
  if (secretToken) payload.secret_token = secretToken;
  const { data } = await axios.post(apiUrl(botToken, "setWebhook"), payload, {
    timeout: DEFAULT_TIMEOUT
  });
  return data;
};

/** deleteWebhook — desregistra o webhook (rotação de token/desconexão). */
export const telegramDeleteWebhook = async (
  botToken: string
): Promise<any> => {
  const { data } = await axios.post(
    apiUrl(botToken, "deleteWebhook"),
    { drop_pending_updates: true },
    { timeout: DEFAULT_TIMEOUT }
  );
  return data;
};

/** sendMessage — envio de texto simples para um chat_id. */
export const telegramSendMessage = async (
  botToken: string,
  chatId: string | number,
  text: string,
  replyToMessageId?: number
): Promise<any> => {
  const payload: any = { chat_id: chatId, text };
  if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;
  const { data } = await axios.post(apiUrl(botToken, "sendMessage"), payload, {
    timeout: DEFAULT_TIMEOUT
  });
  return data?.result; // Message { message_id, chat, ... }
};
