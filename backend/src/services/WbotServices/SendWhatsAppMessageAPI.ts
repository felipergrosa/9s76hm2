import { delay, WAMessage } from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

import formatBody from "../../helpers/Mustache";
import Contact from "../../models/Contact";
import { getWbot } from "../../libs/wbot";
import RefreshContactAvatarService from "../ContactServices/RefreshContactAvatarService";
import ResolveSendJid from "../../helpers/ResolveSendJid";

interface Request {
  body: string;
  whatsappId: number;
  contact: Contact;
  quotedMsg?: Message;
  msdelay?: number;
}

const SendWhatsAppMessage = async ({
  body,
  whatsappId,
  contact,
  quotedMsg,
  msdelay
}: Request): Promise<WAMessage> => {
  let options = {};
  const wbot = await getWbot(whatsappId);
  // Resolver JID correto para envio (trata LIDs → número real)
  const number = await ResolveSendJid(contact, contact.isGroup, whatsappId);

  // Atualiza nome proativamente se ainda estiver vazio/igual ao número (antes do primeiro envio)
  if (!contact.isGroup) {
    const currentName = (contact.name || "").trim();
    const isNumberName = currentName === "" || currentName.replace(/\D/g, "") === String(contact.number);
    if (isNumberName) {
      try {
        await RefreshContactAvatarService({ contactId: contact.id, companyId: (contact as any).companyId, whatsappId });
        await (contact as any).reload?.();
      } catch (e) {
        // não bloquear envio se falhar
      }
    }
  }

  if (quotedMsg) {
    const chatMessages = await Message.findOne({
      where: {
        id: quotedMsg.id
      }
    });

    if (chatMessages) {
      const msgFound = JSON.parse(chatMessages.dataJson);

      options = {
        quoted: {
          key: msgFound.key,
          message: {
            extendedTextMessage: msgFound.message.extendedTextMessage
          }
        }
      };
    }
  }

  try {
    await delay(msdelay)
    const sentMessage = await wbot.sendMessage(
      number,
      {
        text: body
      },
      {
        ...options
      }
    );

    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
