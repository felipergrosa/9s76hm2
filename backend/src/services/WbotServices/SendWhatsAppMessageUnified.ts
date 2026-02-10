import * as Sentry from "@sentry/node";
import { proto } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import { GetTicketAdapter } from "../../helpers/GetWhatsAppAdapter";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import formatBody from "../../helpers/Mustache";
import RefreshContactAvatarService from "../ContactServices/RefreshContactAvatarService";
import logger from "../../utils/logger";
import ResolveSendJid from "../../helpers/ResolveSendJid";
import { IWhatsAppMessage } from "../../libs/whatsapp";

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

/**
 * Serviço unificado de envio de mensagem WhatsApp
 * Usa adapters (Baileys ou Official API) de forma transparente
 * 
 * @example
 * ```typescript
 * const message = await SendWhatsAppMessageUnified({
 *   body: "Olá!",
 *   ticket: ticket
 * });
 * ```
 */
const SendWhatsAppMessageUnified = async ({
  body,
  ticket,
  quotedMsg,
  msdelay = 0,
  vCard,
  isForwarded = false,
  templateButtons,
  messageTitle,
  imageUrl,
}: Request): Promise<IWhatsAppMessage | proto.WebMessageInfo> => {
  
  try {
    logger.info(`[SendUnified] Enviando mensagem para ticket ${ticket.id} (whatsappId=${ticket.whatsappId})`);
    
    // Obter adapter apropriado (Baileys ou Official API)
    const adapter = await GetTicketAdapter(ticket);
    const channelType = adapter.channelType;
    
    logger.debug(`[SendUnified] Usando adapter: ${channelType}`);
    
    // Obter contato
    const contactNumber = await Contact.findByPk(ticket.contactId);
    if (!contactNumber) {
      throw new AppError("ERR_CONTACT_NOT_FOUND", 404);
    }

    // Resolver JID correto para envio (trata LIDs → número real)
    const number = await ResolveSendJid(contactNumber, ticket.isGroup);

    // Atualizar nome/avatar proativamente se necessário
    if (!ticket.isGroup && channelType === "baileys") {
      const currentName = (contactNumber.name || "").trim();
      const isNumberName = currentName === "" || currentName.replace(/\D/g, "") === String(contactNumber.number);
      if (isNumberName) {
        try {
          await RefreshContactAvatarService({
            contactId: ticket.contactId,
            companyId: ticket.companyId,
            whatsappId: ticket.whatsappId
          });
        } catch (e) {
          // Não bloquear envio se falhar
        }
      }
    }

    // Delay antes de enviar
    if (msdelay > 0) {
      await new Promise(resolve => setTimeout(resolve, msdelay));
    }

    let sentMessage: IWhatsAppMessage;

    // ===== ENVIO DE VCARD =====
    if (vCard) {
      const numberContact = vCard.number;
      const firstName = vCard.name.split(" ")[0];
      const lastName = String(vCard.name).replace(firstName, "");

      const vcardContent =
        `BEGIN:VCARD\n` +
        `VERSION:3.0\n` +
        `N:${lastName};${firstName};;;\n` +
        `FN:${vCard.name}\n` +
        `TEL;type=CELL;waid=${numberContact}:+${numberContact}\n` +
        `END:VCARD`;

      sentMessage = await adapter.sendMessage({
        to: number.split("@")[0], // Apenas o número
        vcard: vcardContent
      });

      await ticket.update({
        lastMessage: formatBody(vcardContent, ticket),
        imported: null,
      });

      return sentMessage;
    }

    // ===== ENVIO DE MENSAGEM COM BOTÕES =====
    if (templateButtons && templateButtons.length > 0) {
      const formattedBody = formatBody(body || "", ticket);
      
      // Converter template buttons para formato simplificado
      const buttons = templateButtons
        .filter(btn => btn.quickReplyButton)
        .map(btn => ({
          id: btn.quickReplyButton!.id,
          title: btn.quickReplyButton!.displayText
        }));

      // Se tem imagem
      if (imageUrl) {
        sentMessage = await adapter.sendMessage({
          to: number.split("@")[0],
          body: formattedBody,
          mediaUrl: imageUrl,
          mediaType: "image",
          caption: formattedBody,
          buttons: buttons.length > 0 ? buttons : undefined
        });
      } else {
        // Apenas texto com botões
        sentMessage = await adapter.sendMessage({
          to: number.split("@")[0],
          body: formattedBody,
          buttons: buttons.length > 0 ? buttons : undefined
        });
      }

      await ticket.update({
        lastMessage: formattedBody,
        imported: null
      });

      return sentMessage;
    }

    // ===== ENVIO DE TEXTO SIMPLES =====
    if (body) {
      const formattedBody = formatBody(body, ticket);

      // Se tem mensagem citada
      let quotedMsgId: string | undefined;
      if (quotedMsg) {
        quotedMsgId = quotedMsg.wid || String(quotedMsg.id) || undefined;
      }

      sentMessage = await adapter.sendMessage({
        to: number.split("@")[0],
        body: formattedBody,
        quotedMsgId
      });

      await ticket.update({
        lastMessage: formattedBody,
        imported: null,
      });

      return sentMessage;
    }

    // Nenhum conteúdo fornecido
    throw new AppError("ERR_NO_MESSAGE_CONTENT_PROVIDED");

  } catch (error: any) {
    Sentry.captureException(error);
    logger.error(`[SendUnified] Erro ao enviar mensagem: ${error.message}`);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      error.message || "ERR_SENDING_WAPP_MSG",
      error.statusCode || 500
    );
  }
};

export default SendWhatsAppMessageUnified;
