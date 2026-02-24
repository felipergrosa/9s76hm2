import { WAMessage } from "@whiskeysockets/baileys";
import WALegacySocket from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import SendWhatsAppMessage from "./SendWhatsAppMessage";
import formatBody from "../../helpers/Mustache";
import {getBodyMessage} from "./wbotMessageListener";
import CreateMessageService from "../MessageServices/CreateMessageService";
import ResolveSendJid from "../../helpers/ResolveSendJid";

interface ReactionRequest {
  messageId: string;
  ticket: Ticket;
  reactionType: string; // Exemplo: 'like', 'heart', etc.
}

const SendWhatsAppReaction = async ({
  messageId,
  ticket,
  reactionType
}: ReactionRequest): Promise<WAMessage> => {
  const wbot = await GetTicketWbot(ticket);

  // Resolver JID correto para envio (trata LIDs → número real)
  const number = await ResolveSendJid(ticket.contact, ticket.isGroup, ticket.whatsappId);

  // VALIDAÇÃO: Se não conseguiu resolver o JID, não enviar
  if (!number) {
    logger.error(`[SendReaction] ❌ Não foi possível resolver JID para envio. Contact: ${ticket.contact?.id}, Ticket: ${ticket.id}`);
    throw new AppError("Não foi possível resolver o número de destino. Contato pode ter número inválido ou não estar sincronizado.", 400);
  }

  try {
    const messageToReact = await Message.findOne({
      where: {
        id: messageId
      }
    });

    if (!messageToReact) {
      throw new AppError("Message not found");
    }

    if (!reactionType) {
      throw new AppError("ReactionType not found");
    }

    const msgFound = JSON.parse(messageToReact.dataJson);

    console.log(reactionType);

    const msg = await wbot.sendMessage(number, {
      react: {
        text: reactionType, // O tipo de reação
        key: msgFound.key // A chave da mensagem original a qual a reação se refere
      }

    });


    return msg;
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_REACTION");
  }
};

export default SendWhatsAppReaction;
