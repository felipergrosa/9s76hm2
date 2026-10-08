import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import formatBody from "../../helpers/Mustache";
import logger from "../../utils/logger";
import {
  telegramSendMessage,
  safeTelegramError
} from "./telegramApi";
import { telegramChatIdFromContact } from "./telegramContact";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
}

/**
 * Extrai o message_id do Telegram guardado no dataJson da mensagem citada
 * (inbound grava o update completo) para vincular reply_to_message_id.
 */
const quotedTelegramMessageId = (quotedMsg?: Message): number | undefined => {
  if (!quotedMsg?.dataJson) return undefined;
  try {
    const parsed = JSON.parse(quotedMsg.dataJson);
    const id = parsed?.message?.message_id;
    return typeof id === "number" ? id : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Envia texto de um ticket Telegram para a Bot API.
 * Segue o contrato de sendFacebookMessage: formata variáveis Mustache,
 * atualiza lastMessage e devolve o resultado bruto da API para o caller
 * persistir a Message (ack=2 — não há leitura rastreada no canal).
 */
const sendTelegramMessage = async ({
  body,
  ticket,
  quotedMsg
}: Request): Promise<any> => {
  // O include whatsapp do ShowTicketService tem attributes restritos
  // (sem telegramBotToken) — busca direta com apenas as colunas necessárias.
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId, {
    attributes: ["id", "telegramBotToken"]
  });

  if (!whatsapp?.telegramBotToken) {
    throw new AppError("ERR_TELEGRAM_NOT_CONFIGURED", 400);
  }

  const chatId = telegramChatIdFromContact(ticket.contact);
  if (!chatId) {
    throw new AppError("ERR_TELEGRAM_INVALID_CONTACT", 400);
  }

  try {
    const result = await telegramSendMessage(
      whatsapp.telegramBotToken,
      chatId,
      formatBody(body, ticket),
      quotedTelegramMessageId(quotedMsg)
    );

    await ticket.update({ lastMessage: body });

    return result;
  } catch (err: any) {
    // Segurança: err.message do axios embute a URL com o botToken — só loga
    // a versão sanitizada (status + description da API).
    logger.error(
      `[Telegram] sendMessage falhou (ticketId=${ticket.id}): ${safeTelegramError(err)}`
    );
    throw new AppError("ERR_TELEGRAM_SEND_FAILED", 502);
  }
};

export default sendTelegramMessage;
