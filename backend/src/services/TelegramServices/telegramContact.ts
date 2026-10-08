import Contact from "../../models/Contact";

// =============================================================================
// Identidade do contato Telegram.
// O "number" sintético é tg_<whatsappId>_<chatId> — o prefixo por conexão é
// necessário porque Contact.number tem UNIQUE GLOBAL (sem companyId): o mesmo
// usuário Telegram pode falar com bots de empresas diferentes e os chat_id
// seriam idênticos. O chat_id puro também fica em remoteJid como fallback.
// =============================================================================

export const telegramNumber = (
  whatsappId: number,
  chatId: string | number
): string => `tg_${whatsappId}_${chatId}`;

/**
 * Extrai o chat_id Telegram de um contato: primeiro do number sintético,
 * depois do remoteJid (chat_id puro, inclusive negativo de grupos).
 */
export const telegramChatIdFromContact = (
  contact: Contact | any
): string | null => {
  const number = String(contact?.number || "");
  const match = number.match(/^tg_\d+_(-?\d+)$/);
  if (match) return match[1];

  const remoteJid = String(contact?.remoteJid || "");
  if (/^-?\d+$/.test(remoteJid)) return remoteJid;

  return null;
};
