import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import formatBody from "../../helpers/Mustache";
import ResolveSendJid from "../../helpers/ResolveSendJid";
import { GetTicketAdapter } from "../../helpers/GetWhatsAppAdapter";
import EnsureOfficialSessionWindow from "../MetaServices/EnsureOfficialSessionWindow";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { buildOfficialPreviewData } from "../../utils/officialMessagePreview";
import { IWhatsAppMessage, ISendMessageOptions } from "../../libs/whatsapp";

/**
 * Tipos de mensagem interativa suportados pela API Oficial (Cloud API).
 * - buttons: botões de resposta rápida (interactive.type = "button", max 3)
 * - list: lista com seções (interactive.type = "list")
 * - cta_url: botão de ação com link (interactive.type = "cta_url")
 * - pix: Cloud API não tem botão "copiar" em interactive livre —
 *        enviado como texto contendo a chave/código copia-e-cola.
 */
export type InteractiveMessageType = "buttons" | "list" | "cta_url" | "pix";

interface InteractiveButton {
  title: string;
}

interface InteractiveSectionRow {
  title: string;
  description?: string;
}

interface InteractiveSection {
  title?: string;
  rows: InteractiveSectionRow[];
}

interface InteractiveUrlButton {
  displayText: string;
  url: string;
}

interface Request {
  ticket: Ticket;
  type: InteractiveMessageType;
  body: string;
  footer?: string;
  header?: string;
  buttons?: InteractiveButton[];
  listButtonText?: string;
  sections?: InteractiveSection[];
  urlButton?: InteractiveUrlButton;
  pixKey?: string;
}

/**
 * Envia mensagem interativa pelo compositor do ticket.
 * Apenas conexões da API Oficial (channelType = "official") suportam
 * interactive messages na Meta Cloud API.
 */
const SendInteractiveMessageService = async ({
  ticket,
  type,
  body,
  footer,
  header,
  buttons,
  listButtonText,
  sections,
  urlButton,
  pixKey
}: Request): Promise<IWhatsAppMessage> => {
  // Conexão precisa ser API Oficial — botões/listas nativos do Baileys
  // usam outro fluxo (relayMessage/nativeFlowMessage).
  const whatsapp = await Whatsapp.findOne({
    where: { id: ticket.whatsappId, companyId: ticket.companyId }
  });

  if (!whatsapp) {
    throw new AppError("ERR_WAPP_NOT_FOUND", 404);
  }

  if (whatsapp.channelType !== "official") {
    throw new AppError(
      "Mensagens interativas estão disponíveis apenas para conexões da API Oficial (WABA).",
      400
    );
  }

  // Cloud API não opera em grupos
  if (ticket.isGroup) {
    throw new AppError(
      "Mensagens interativas não são suportadas em grupos na API Oficial.",
      400
    );
  }

  // Mensagens de sessão exigem janela de 24h ativa
  await EnsureOfficialSessionWindow(ticket);

  const contact = await Contact.findByPk(ticket.contactId);
  if (!contact) {
    throw new AppError("ERR_CONTACT_NOT_FOUND", 404);
  }

  const jid = await ResolveSendJid(contact, ticket.isGroup, ticket.whatsappId);
  if (!jid) {
    throw new AppError(
      "Não foi possível resolver o número de destino. Contato pode ter número inválido ou não estar sincronizado.",
      400
    );
  }

  const adapter = await GetTicketAdapter(ticket);

  const formattedBody = formatBody(body || "", ticket);
  const formattedFooter = footer ? formatBody(footer, ticket) : undefined;

  const recipient = jid.split("@")[0];

  let sendOptions: ISendMessageOptions;
  let persistedBody = formattedBody;
  let mediaType = "interactive";
  let previewData: string | null = null;

  switch (type) {
    case "buttons": {
      if (!buttons || buttons.length < 1 || buttons.length > 3) {
        throw new AppError("Mensagem de botões requer entre 1 e 3 botões.", 400);
      }
      const mappedButtons = buttons.map((btn, index) => ({
        id: `opt-${index + 1}`,
        title: String(btn.title || "").trim()
      }));
      if (mappedButtons.some(btn => !btn.title)) {
        throw new AppError("Todos os botões precisam de texto.", 400);
      }

      sendOptions = {
        to: recipient,
        body: formattedBody,
        buttons: mappedButtons,
        footer: formattedFooter
      };

      previewData = buildOfficialPreviewData({
        body: formattedBody,
        footer: formattedFooter,
        buttons: mappedButtons.map(btn => ({
          id: btn.id,
          text: btn.title,
          type: "quick_reply"
        })),
        meta: { kind: "interactive-buttons" }
      });
      break;
    }

    case "list": {
      if (!sections || sections.length < 1 || sections.length > 10) {
        throw new AppError("Mensagem de lista requer entre 1 e 10 seções.", 400);
      }
      const mappedSections = sections.map((section, sIndex) => ({
        title: String(section.title || `Seção ${sIndex + 1}`),
        rows: (section.rows || []).map((row, rIndex) => ({
          id: `row-${sIndex + 1}-${rIndex + 1}`,
          title: String(row.title || "").trim(),
          description: row.description
            ? String(row.description).trim()
            : undefined
        }))
      }));
      if (
        mappedSections.some(
          section => section.rows.length < 1 || section.rows.length > 10
        )
      ) {
        throw new AppError("Cada seção requer entre 1 e 10 itens.", 400);
      }
      if (
        mappedSections.some(section => section.rows.some(row => !row.title))
      ) {
        throw new AppError("Todos os itens da lista precisam de texto.", 400);
      }

      sendOptions = {
        to: recipient,
        body: formattedBody,
        listSections: mappedSections,
        listButtonText: listButtonText || "Ver opções",
        listTitle: header ? formatBody(header, ticket) : undefined,
        footer: formattedFooter
      };

      previewData = buildOfficialPreviewData({
        body: formattedBody,
        footer: formattedFooter,
        rows: mappedSections.flatMap(section =>
          section.rows.map(row => ({
            id: row.id,
            text: row.title,
            description: row.description
          }))
        ),
        meta: { kind: "interactive-list" }
      });
      break;
    }

    case "cta_url": {
      const displayText = String(urlButton?.displayText || "").trim();
      const url = String(urlButton?.url || "").trim();
      if (!displayText || !url) {
        throw new AppError("Botão de URL requer texto e endereço.", 400);
      }
      if (!/^https?:\/\//i.test(url)) {
        throw new AppError("A URL do botão precisa começar com http:// ou https://", 400);
      }

      sendOptions = {
        to: recipient,
        body: formattedBody,
        ctaUrlButton: { displayText, url },
        footer: formattedFooter
      };

      previewData = buildOfficialPreviewData({
        body: formattedBody,
        footer: formattedFooter,
        buttons: [{ text: displayText, type: "url", url }],
        meta: { kind: "interactive-cta-url" }
      });
      break;
    }

    case "pix": {
      const key = String(pixKey || "").trim();
      if (!key) {
        throw new AppError("Chave/código PIX é obrigatório.", 400);
      }
      // Cloud API não possui botão "copiar" em mensagens interativas livres
      // (copy_code só existe em templates). Fallback: texto com a chave em
      // destaque para o cliente copiar manualmente.
      persistedBody = `${formattedBody}\n\n${key}`;
      mediaType = "conversation";

      sendOptions = {
        to: recipient,
        body: persistedBody,
        mediaType: "text"
      };
      break;
    }

    default:
      throw new AppError("Tipo de mensagem interativa inválido.", 400);
  }

  const sentMessage = (await adapter.sendMessage(
    sendOptions
  )) as IWhatsAppMessage;

  // Persistir mensagem enviada (API Oficial não devolve echo via socket Baileys)
  await CreateMessageService({
    messageData: {
      wid: sentMessage.id,
      ticketId: ticket.id,
      contactId: ticket.contactId,
      body: persistedBody,
      fromMe: true,
      read: true,
      ack: 1,
      mediaType,
      remoteJid: contact.remoteJid,
      dataJson: previewData || undefined
    },
    companyId: ticket.companyId
  });

  await ticket.update({
    lastMessage: persistedBody,
    imported: null
  });

  logger.info(
    `[SendInteractiveMessageService] Interativa "${type}" enviada: ticketId=${ticket.id}, wid=${sentMessage.id}`
  );

  return sentMessage;
};

export default SendInteractiveMessageService;
