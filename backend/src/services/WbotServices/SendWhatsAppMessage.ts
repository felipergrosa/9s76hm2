import {
  WAMessage,
  delay,
  WAMessageContent,
  WASocket,
  proto,
} from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import { isNil } from "lodash";
import fs from "fs";

import formatBody from "../../helpers/Mustache";
import RefreshContactAvatarService from "../ContactServices/RefreshContactAvatarService";
import ResolveSendJid from "../../helpers/ResolveSendJid";

interface TemplateButton {
  index: number;
  urlButton?: {
    displayText: string;
    url: string;
  };
  callButton?: {
    displayText: string;
    phoneNumber: string;
  };
  quickReplyButton?: {
    displayText: string;
    id: string;
  };
}

interface Request {
  body?: string;
  ticket: Ticket;
  quotedMsg?: Message;
  msdelay?: number;
  vCard?: Contact;
  isForwarded?: boolean;
  templateButtons?: TemplateButton[];
  messageTitle?: string;
  imageUrl?: string;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg,
  msdelay,
  vCard,
  isForwarded = false,
  templateButtons,
  messageTitle,
  imageUrl,
}: Request): Promise<WAMessage | proto.WebMessageInfo> => {
  let options: any = {};
  const wbot = await GetTicketWbot(ticket);
  const contactNumber = await Contact.findByPk(ticket.contactId);

  // Resolver JID correto para envio (trata LIDs → número real)
  const number = await ResolveSendJid(contactNumber, ticket.isGroup);

  // Atualiza nome proativamente se ainda estiver vazio/igual ao número (antes do primeiro envio)
  if (!ticket.isGroup) {
    const currentName = (contactNumber.name || "").trim();
    const isNumberName = currentName === "" || currentName.replace(/\D/g, "") === String(contactNumber.number);
    if (isNumberName) {
      try {
        await RefreshContactAvatarService({ contactId: ticket.contactId, companyId: ticket.companyId, whatsappId: ticket.whatsappId });
      } catch (e) {
        // não bloquear envio se falhar
      }
    }
  }

  if (quotedMsg) {
    const chatMessages = await Message.findOne({
      where: {
        id: quotedMsg.id,
      },
    });

    if (chatMessages) {
      const msgFound = JSON.parse(chatMessages.dataJson);

      if (msgFound.message.extendedTextMessage !== undefined) {
        options = {
          quoted: {
            key: msgFound.key,
            message: {
              extendedTextMessage: msgFound.message.extendedTextMessage,
            },
          },
        };
      } else {
        options = {
          quoted: {
            key: msgFound.key,
            message: {
              conversation: msgFound.message.conversation,
            },
          },
        };
      }
    }
  }

  if (!isNil(vCard)) {
    const numberContact = vCard.number;
    const firstName = vCard.name.split(" ")[0];
    const lastName = String(vCard.name).replace(firstName, "");

    const vcard =
      `BEGIN:VCARD\n` +
      `VERSION:3.0\n` +
      `N:${lastName};${firstName};;;\n` +
      `FN:${vCard.name}\n` +
      `TEL;type=CELL;waid=${numberContact}:+${numberContact}\n` +
      `END:VCARD`;

    try {
      await delay(msdelay);
      const sentMessage = await wbot.sendMessage(
        number,
        {
          contacts: {
            displayName: `${vCard.name}`,
            contacts: [{ vcard }],
          },
        },
        options
      );
      await ticket.update({
        lastMessage: formatBody(vcard, ticket),
        imported: null,
      });
      return sentMessage as WAMessage;
    } catch (err) {
      Sentry.captureException(err);
      console.log(err);
      throw new AppError("ERR_SENDING_WAPP_MSG");
    }
  }

  // ✅ ENVIO DE MENSAGEM COM BOTÕES
  if (templateButtons && templateButtons.length > 0) {
    try {
      await delay(msdelay);

      const formattedBody = formatBody(body || "", ticket);
      const footer = messageTitle || "";
      let mediaMessage: any = null;

      if (imageUrl) {
        if (fs.existsSync(imageUrl)) {
          const imageBuffer = fs.readFileSync(imageUrl);
          mediaMessage = {
            image: imageBuffer,
            caption: formattedBody,
            footer,
            templateButtons,
            headerType: 4
          };
        } else if (imageUrl.startsWith("http")) {
          mediaMessage = {
            image: { url: imageUrl },
            caption: formattedBody,
            footer,
            templateButtons,
            headerType: 4
          };
        }
      }

      const messageData = mediaMessage || {
        text: formattedBody,
        footer,
        templateButtons,
        headerType: 1
      };

      const sentMessage = await wbot.sendMessage(
        number,
        messageData as any,
        options
      );

      await ticket.update({ lastMessage: formattedBody, imported: null });
      return sentMessage as WAMessage;
    } catch (err) {
      console.log(
        `Erro ao enviar mensagem com botões na company ${ticket.companyId}: `,
        err
      );
      Sentry.captureException(err);
      throw new AppError("ERR_SENDING_WAPP_BUTTON_MSG");
    }
  }

  if (body) {
    try {
      await delay(msdelay);
      const sentMessage = await wbot.sendMessage(
        number,
        {
          text: formatBody(body, ticket),
          contextInfo: {
            forwardingScore: isForwarded ? 2 : 0,
            isForwarded: !!isForwarded,
          },
        },
        options
      );
      await ticket.update({
        lastMessage: formatBody(body, ticket),
        imported: null,
      });
      return sentMessage as WAMessage;
    } catch (err) {
      Sentry.captureException(err);
      console.log(err);
      throw new AppError("ERR_SENDING_WAPP_MSG");
    }
  }

  throw new AppError("ERR_NO_MESSAGE_CONTENT_PROVIDED");
};

export default SendWhatsAppMessage;
