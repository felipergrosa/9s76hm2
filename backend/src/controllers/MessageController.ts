import { Request, Response } from "express";
import AppError from "../errors/AppError";
import fs from "fs";
import GetTicketWbot from "../helpers/GetTicketWbot";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import { getIO } from "../libs/socket";
import { emitToCompanyRoom } from "../libs/socketEmit";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import Queue from "../models/Queue";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";
import path from "path";
import { isNil } from "lodash";
import { Mutex } from "async-mutex";
import { Op } from "sequelize";

import ListMessagesService from "../services/MessageServices/ListMessagesService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import DeleteWhatsAppMessage from "../services/WbotServices/DeleteWhatsAppMessage";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import SendWhatsAppMessageUnified from "../services/WbotServices/SendWhatsAppMessageUnified";
import SendWhatsAppMediaUnified from "../services/WbotServices/SendWhatsAppMediaUnified";
import CreateMessageService from "../services/MessageServices/CreateMessageService";
import { sendFacebookMessageMedia } from "../services/FacebookServices/sendFacebookMessageMedia";
import sendFaceMessage from "../services/FacebookServices/sendFacebookMessage";
import ShowPlanCompanyService from "../services/CompanyService/ShowPlanCompanyService";
import ListMessagesServiceAll from "../services/MessageServices/ListMessagesServiceAll";
import ShowContactService from "../services/ContactServices/ShowContactService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import Contact from "../models/Contact";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import CompaniesSettings from "../models/CompaniesSettings";
import { verifyMessageFace, verifyMessageMedia } from "../services/FacebookServices/facebookMessageListener";
import EditWhatsAppMessage from "../services/MessageServices/EditWhatsAppMessage";
import CheckContactNumber from "../services/WbotServices/CheckNumber";
import { generateWAMessageFromContent, generateWAMessageContent, proto } from "@whiskeysockets/baileys";
import SendWhatsAppReaction from "../services/WbotServices/SendWhatsAppReaction";
import TranscribeAudioMessageService from "../services/MessageServices/TranscribeAudioMessageService";
import ShowMessageService, { GetWhatsAppFromMessage } from "../services/MessageServices/ShowMessageService";
import SyncChatHistoryService from "../services/MessageServices/SyncChatHistoryService";

type IndexQuery = {
  pageNumber: string;
  ticketTrakingId: string;
  selectedQueues?: string;
};

interface TokenPayload {
  id: string;
  username: string;
  profile: string;
  companyId: number;
  iat: number;
  exp: number;
}

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
  number?: string;
  isPrivate?: string;
  vCard?: Contact;
};

// Função utilitária para extrair o campo body de mensagens
const extractMessageBody = (msg: any, fallback: string = "Mensagem interativa"): string => {
  if (msg.message?.interactiveMessage?.body?.text) {
    return msg.message.interactiveMessage.body.text;
  }
  if (msg.message?.listMessage?.description) {
    return msg.message.listMessage.description;
  }
  if (msg.message?.interactiveMessage?.nativeFlowMessage?.buttons[0]?.buttonParamsJson) {
    try {
      const params = JSON.parse(msg.message.interactiveMessage.nativeFlowMessage.buttons[0].buttonParamsJson);
      return params.order?.items[0]?.name || params.display_text || fallback;
    } catch {
      return fallback;
    }
  }
  return msg.message?.conversation || fallback;
};

// Função para gerar IDs únicos
const generateRandomCode = (length: number = 11): string => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }
  return code;
};

// Adicionar reação
export const addReaction = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { messageId } = req.params;
    const { type } = req.body;
    const { companyId, id } = req.user;

    const message = await Message.findByPk(messageId);
    if (!message) {
      throw new AppError("Mensagem não encontrada", 404);
    }

    const ticket = await Ticket.findByPk(message.ticketId, { include: ["contact"] });
    if (!ticket) {
      throw new AppError("Ticket não encontrado", 404);
    }

    const reactionResult = await SendWhatsAppReaction({
      messageId,
      ticket,
      reactionType: type,
    });

    const io = getIO();
    await emitToCompanyRoom(
      companyId,
      ticket.uuid,
      `company-${companyId}-appMessage`,
      {
        action: "update",
        message,
        ticket,
      }
    );

    return res.status(200).json({
      message: "Reação adicionada com sucesso!",
      reactionResult,
    });
  } catch (error) {
    console.error("Erro ao adicionar reação:", error);
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return res.status(500).json({ message: "Erro ao adicionar reação", error: String(error) });
  }
};

// Enviar mensagem de lista
export const sendListMessage = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { title, text, buttonText, footer, sections } = req.body;

  try {
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    const contact = await Contact.findByPk(ticket.contactId);
    if (!contact) {
      throw new AppError("Contact not found", 404);
    }

    const whatsapp = await Whatsapp.findOne({ where: { id: ticket.whatsappId } });
    if (!whatsapp || !whatsapp.number) {
      throw new AppError("Número de WhatsApp não encontrado", 404);
    }

    const botNumber = whatsapp.number;
    const wbot = await GetTicketWbot(ticket);
    // Validações de sections e rows para evitar payload inválido
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      throw new AppError("Sections must be a non-empty array", 400);
    }
    if (!sections.every((section: any) => Array.isArray(section.rows) && section.rows.length > 0)) {
      throw new AppError("Each section must have at least one row", 400);
    }
    const number = `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;
    const listMessage: proto.IMessage = {
      listMessage: {
        title: title || "Lista de Opções",
        description: text || "Selecione uma opção",
        buttonText: buttonText || "Selecionar",
        footerText: footer || "",
        sections: sections.map((section: any) => ({
          title: section.title || "Section",
          rows: section.rows.map((row: any) => ({
            rowId: row.id || generateRandomCode(10),
            title: row.title || "Option",
            description: row.description || "",
          })),
        })),
        listType: 1, // Single-select list
      },
    };

    console.debug("Sending list message:", JSON.stringify(listMessage, null, 2));

    const timestamp = Number(Math.round(Date.now() / 1000));
    console.debug("Timestamp:", timestamp);

    const newMsg = generateWAMessageFromContent(number, listMessage, {
      userJid: botNumber,
    });

    await wbot.relayMessage(number, newMsg.message, { messageId: newMsg.key.id! });

    const messageBody = text || title || "Lista interativa";
    const messageData = {
      wid: newMsg.key.id,
      ticketId: ticket.id,
      body: messageBody,
      fromMe: true,
      mediaType: "listMessage",
      read: true,
      ack: 1,
      remoteJid: number,
      participant: ticket.isGroup ? contact.number : "",
      dataJson: JSON.stringify(newMsg),
      ticketTrakingId: ticket.ticketTrakingId,
      companyId: ticket.companyId,
      isPrivate: false,
      isEdited: false,
      isForwarded: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await CreateMessageService({ messageData, companyId: ticket.companyId });

    return res.status(200).json({ message: "List message sent successfully", newMsg });
  } catch (err) {
    console.error("Error sending list message:", err);
    throw new AppError(`Error sending list message: ${err.message}`, 500);
  }
};

// Enviar mensagem de cópia
export const sendCopyMessage = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { title, description, buttonText, copyText } = req.body;

  try {
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }
    const contact = await Contact.findByPk(ticket.contactId);
    if (!contact) {
      throw new AppError("Contact not found", 404);
    }
    const whatsapp = await Whatsapp.findOne({ where: { id: ticket.whatsappId } });
    if (!whatsapp || !whatsapp.number) {
      throw new AppError("Número de WhatsApp não encontrado", 404);
    }

    const botNumber = whatsapp.number;
    const wbot = await GetTicketWbot(ticket);
    const copyMessage = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: {
              text: title || "Botão copiar",
            },
            footer: {
              text: description || "Botão copiar",
            },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "cta_copy",
                  buttonParamsJson: JSON.stringify({
                    display_text: buttonText || "Botão copiar",
                    copy_code: copyText || "Botão copiar",
                  }),
                },
              ],
            },
          },
        },
      },
    };

    const number = `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;
    const newMsg = generateWAMessageFromContent(number, copyMessage, { userJid: botNumber });
    await wbot.relayMessage(number, newMsg.message, { messageId: newMsg.key.id! });

    const messageBody = title || "Mensagem de cópia interativa";
    const messageData = {
      wid: newMsg.key.id,
      ticketId: ticket.id,
      body: messageBody,
      fromMe: true,
      mediaType: "viewOnceMessage",
      read: true,
      ack: 1,
      remoteJid: number,
      participant: ticket.isGroup ? contact.number : "",
      dataJson: JSON.stringify(newMsg),
      ticketTrakingId: ticket.ticketTrakingId,
      companyId: ticket.companyId,
      isPrivate: false,
      isEdited: false,
      isForwarded: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await CreateMessageService({ messageData, companyId: ticket.companyId });

    return res.status(200).json({ message: "Copy message sent successfully", newMsg });
  } catch (error) {
    console.error("Erro ao enviar a mensagem de cópia:", error);
    throw new AppError("Error sending copy message", 500);
  }
};

// Enviar mensagem de chamada
export const sendCALLMessage = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { title, description, buttonText, copyText } = req.body;

  try {
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }
    const contact = await Contact.findByPk(ticket.contactId);
    if (!contact) {
      throw new AppError("Contact not found", 404);
    }
    const whatsapp = await Whatsapp.findOne({ where: { id: ticket.whatsappId } });
    if (!whatsapp || !whatsapp.number) {
      throw new AppError("Número de WhatsApp não encontrado", 404);
    }

    const botNumber = whatsapp.number;
    const wbot = await GetTicketWbot(ticket);
    const callMessage = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: {
              text: title || "Botão de chamada",
            },
            footer: {
              text: description || "Botão de chamada",
            },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "cta_call",
                  buttonParamsJson: JSON.stringify({
                    display_text: buttonText || "Botão de chamada",
                    phone_number: copyText || "Botão de chamada",
                  }),
                },
              ],
            },
          },
        },
      },
    };

    const number = `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;
    const newMsg = generateWAMessageFromContent(number, callMessage, { userJid: botNumber });
    await wbot.relayMessage(number, newMsg.message, { messageId: newMsg.key.id! });

    const messageBody = title || "Mensagem de chamada interativa";
    const messageData = {
      wid: newMsg.key.id,
      ticketId: ticket.id,
      body: messageBody,
      fromMe: true,
      mediaType: "viewOnceMessage",
      read: true,
      ack: 1,
      remoteJid: number,
      participant: ticket.isGroup ? contact.number : "",
      dataJson: JSON.stringify(newMsg),
      ticketTrakingId: ticket.ticketTrakingId,
      companyId: ticket.companyId,
      isPrivate: false,
      isEdited: false,
      isForwarded: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await CreateMessageService({ messageData, companyId: ticket.companyId });

    return res.status(200).json({ message: "Call message sent successfully", newMsg });
  } catch (error) {
    console.error("Erro ao enviar a mensagem de chamada:", error);
    throw new AppError("Error sending call message", 500);
  }
};

// Enviar mensagem de URL
export const sendURLMessage = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { image, title, description, buttonText, copyText } = req.body;

  try {
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }
    const contact = await Contact.findByPk(ticket.contactId);
    if (!contact) {
      throw new AppError("Contact not found", 404);
    }
    const whatsapp = await Whatsapp.findOne({ where: { id: ticket.whatsappId } });
    if (!whatsapp || !whatsapp.number) {
      throw new AppError("Número de WhatsApp não encontrado", 404);
    }

    const botNumber = whatsapp.number;
    const wbot = await GetTicketWbot(ticket);
    let urlMessage: proto.IMessage;

    if (image) {
      if (!image.includes("base64,")) {
        throw new AppError("Invalid base64 image format", 400);
      }
      const base64Image = image.split(",")[1];
      const imageMessageContent = await generateWAMessageContent(
        {
          image: {
            url: `data:image/png;base64,${base64Image}`,
          },
        },
        { upload: wbot.waUploadToServer! }
      );

      urlMessage = {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              body: {
                text: title || "Botão URL",
              },
              footer: {
                text: description || "Botão URL",
              },
              header: {
                imageMessage: imageMessageContent.imageMessage,
                hasMediaAttachment: true,
              },
              nativeFlowMessage: {
                buttons: [
                  {
                    name: "cta_url",
                    buttonParamsJson: JSON.stringify({
                      display_text: buttonText || "Botão URL",
                      url: copyText || "https://example.com",
                    }),
                  },
                ],
              },
            },
          },
        },
      };
    } else {
      urlMessage = {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              body: {
                text: title || "Botão URL",
              },
              footer: {
                text: description || "Botão URL",
              },
              nativeFlowMessage: {
                buttons: [
                  {
                    name: "cta_url",
                    buttonParamsJson: JSON.stringify({
                      display_text: buttonText || "Botão URL",
                      url: copyText || "https://example.com",
                    }),
                  },
                ],
              },
            },
          },
        },
      };
    }

    const number = `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;
    const newMsg = generateWAMessageFromContent(number, urlMessage, { userJid: botNumber });
    await wbot.relayMessage(number, newMsg.message, { messageId: newMsg.key.id! });

    const messageBody = title || "Mensagem URL interativa";
    const messageData = {
      wid: newMsg.key.id,
      ticketId: ticket.id,
      body: messageBody,
      fromMe: true,
      mediaType: "viewOnceMessage",
      read: true,
      ack: 1,
      remoteJid: number,
      participant: ticket.isGroup ? contact.number : "",
      dataJson: JSON.stringify(newMsg),
      ticketTrakingId: ticket.ticketTrakingId,
      companyId: ticket.companyId,
      isPrivate: false,
      isEdited: false,
      isForwarded: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await CreateMessageService({ messageData, companyId: ticket.companyId });

    return res.status(200).json({ message: "URL message sent successfully", newMsg });
  } catch (error) {
    console.error("Erro ao enviar a mensagem URL:", error);
    throw new AppError("Error sending URL message", 500);
  }
};

// Enviar mensagem PIX
export const sendPIXMessage = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const {
    title,
    description,
    copyButtonText,
    sendKey,
  }: {
    title: string;
    description?: string;
    copyButtonText?: string;
    sendKey: string;
  } = req.body;

  try {
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    const contact = await Contact.findByPk(ticket.contactId);
    if (!contact) {
      throw new AppError("Contact not found", 404);
    }

    const whatsapp = await Whatsapp.findOne({ where: { id: ticket.whatsappId } });
    if (!whatsapp || !whatsapp.number) {
      throw new AppError("Número de WhatsApp não encontrado", 404);
    }

    const validatePixKey = (key: string): boolean => {
      return (
        /^\+55\d{10,11}$/.test(key) || // PHONE
        /^\d{11}$/.test(key) || // CPF
        /^\d{14}$/.test(key) || // CNPJ
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key) || // EMAIL
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key) // EVP
      );
    };

    if (!validatePixKey(sendKey)) {
      throw new AppError("Invalid PIX key format", 400);
    }

    const number = `${contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;
    const botNumber = whatsapp.number;
    const wbot = await GetTicketWbot(ticket);

    const interactiveMsg = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: {
              text: title || "Copiar Chave PIX",
            },
            footer: {
              text: description || "Clique para copiar a chave PIX",
            },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "cta_copy",
                  buttonParamsJson: JSON.stringify({
                    display_text: copyButtonText || "Copiar Chave PIX",
                    copy_code: sendKey,
                  }),
                },
              ],
            },
          },
        },
      },
    };

    const newMsg = generateWAMessageFromContent(number, interactiveMsg, { userJid: botNumber });
    await wbot.relayMessage(number, newMsg.message, { messageId: newMsg.key.id! });

    const messageBody = title || "Mensagem PIX interativa";
    const messageData = {
      wid: newMsg.key.id,
      ticketId: ticket.id,
      body: messageBody,
      fromMe: true,
      mediaType: "viewOnceMessage",
      read: true,
      ack: 1,
      remoteJid: number,
      participant: ticket.isGroup ? contact.number : "",
      dataJson: JSON.stringify(newMsg),
      ticketTrakingId: ticket.ticketTrakingId,
      companyId: ticket.companyId,
      isPrivate: false,
      isEdited: false,
      isForwarded: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await CreateMessageService({ messageData, companyId: ticket.companyId });

    return res.status(200).json({ message: "Mensagem enviada com sucesso", newMsg });
  } catch (error) {
    console.error("Erro ao enviar a mensagem PIX:", error);
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return res.status(500).json({ message: "Erro interno ao enviar a mensagem PIX", error: String(error) });
  }
};

// Transcrição de áudio

export const transcribeAudioMessage = async (req: Request, res: Response): Promise<Response> => {
  const { fileName } = req.params;
  const { ticketId } = req.query;
  const { companyId } = req.user;

  try {
    const transcribeService = new TranscribeAudioMessageService();
    const transcribedText = await transcribeService.execute(fileName, companyId, ticketId ? Number(ticketId) : undefined);

    if ('error' in transcribedText) {
      return res.status(400).json({ error: transcribedText.error });
    }

    // Persistir em Message quando possível (para reabrir ticket e manter transcrição)
    try {
      const decoded = (() => {
        try {
          return decodeURIComponent(fileName);
        } catch {
          return fileName;
        }
      })();
      const safeRel = decoded
        .split("?")[0]
        .split("#")[0]
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");
      const baseName = safeRel.split("/").pop() || safeRel;
      const ticketIdNum = ticketId ? Number(ticketId) : undefined;

      let msg: Message | null = null;

      if (ticketIdNum && !Number.isNaN(ticketIdNum)) {
        msg = await Message.findOne({
          where: {
            companyId,
            ticketId: ticketIdNum,
            mediaType: "audio",
            [Op.or]: [
              { mediaUrl: safeRel },
              { mediaUrl: baseName },
              { mediaUrl: { [Op.like]: `%/${baseName}` } }
            ]
          },
          order: [["id", "DESC"]]
        });
      }

      if (!msg) {
        msg = await Message.findOne({
          where: {
            companyId,
            mediaType: "audio",
            [Op.or]: [
              { mediaUrl: safeRel },
              { mediaUrl: baseName },
              { mediaUrl: { [Op.like]: `%/${baseName}` } }
            ]
          },
          order: [["id", "DESC"]]
        });
      }

      if (msg) {
        await msg.update({ audioTranscription: transcribedText.transcribedText });

        // Emite update em realtime para atualizar UI sem refresh
        try {
          const ticket = await Ticket.findByPk(msg.ticketId);
          if (ticket) {
            await emitToCompanyRoom(
              companyId,
              ticket.uuid,
              `company-${companyId}-appMessage`,
              {
                action: "update",
                message: msg,
                ticket
              }
            );
          }
        } catch { }
      }
    } catch (persistErr) {
      console.warn("[STT] Falha ao persistir transcrição no banco", persistErr);
    }

    return res.json({ transcribedText });
  } catch (error) {
    console.error(`Erro ao transcrever a mensagem de áudio: ${error}`);
    return res.status(500).json({ error: "Erro ao transcrever a mensagem de áudio." });
  }
};

// Listar mensagens
export const index = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { pageNumber, selectedQueues: queueIdsStringified } = req.query as IndexQuery;
  const { companyId } = req.user;
  let queues: number[] = [];

  const user = await User.findByPk(req.user.id, {
    include: [{ model: Queue, as: "queues" }],
  });

  if (queueIdsStringified) {
    queues = JSON.parse(queueIdsStringified);
  } else {
    user!.queues.forEach((queue) => {
      queues.push(queue.id);
    });
  }

  const { count, messages, ticket, hasMore } = await ListMessagesService({
    pageNumber,
    ticketId,
    companyId,
    queues,
    user: user!,
  });

  if (ticket.channel === "whatsapp" && ticket.whatsappId) {
    await SetTicketMessagesAsRead(ticket);
  }

  return res.json({ count, messages, ticket, hasMore });
};

// Função para obter nome e extensão do arquivo
function obterNomeEExtensaoDoArquivo(url: string): string {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  const filename = pathname.split("/").pop() || "";
  const parts = filename.split(".");

  const nomeDoArquivo = parts[0];
  const extensao = parts[1] || "";

  return `${nomeDoArquivo}.${extensao}`;
}

// Armazenar mensagem
export const store = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { body, quotedMsg, vCard, isPrivate = "false" }: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];
  const { companyId } = req.user;

  let ticket;
  try {
    ticket = await ShowTicketService(ticketId, companyId);
  } catch (e: any) {
    return res.status(404).json({ error: "Ticket não encontrado" });
  }

  const requestUser = await User.findByPk(req.user.id);
  if (requestUser && requestUser.profile !== "admin") {
    const allowedIds = requestUser.allowedConnectionIds || [];
    // Se a lista estiver vazia ou o ID não estiver nela, bloqueia
    if (!allowedIds.includes(ticket.whatsappId)) {
      throw new AppError("ERR_NO_PERMISSION_CONNECTION", 403);
    }
  }

  if (ticket.channel === "whatsapp" && ticket.whatsappId) {
    await SetTicketMessagesAsRead(ticket);
  }

  try {
    if (medias) {
      await Promise.all(
        medias.map(async (media: Express.Multer.File, index) => {
          if (ticket.channel === "whatsapp") {
            await SendWhatsAppMediaUnified({
              media,
              ticket,
              body: Array.isArray(body) ? body[index] : body,
              isPrivate: isPrivate === "true",
              isForwarded: false
            });
          }

          if (["facebook", "instagram"].includes(ticket.channel)) {
            try {
              const sentMedia = await sendFacebookMessageMedia({
                media,
                ticket,
                body: Array.isArray(body) ? body[index] : body,
              });

              if (ticket.channel === "facebook") {
                await verifyMessageMedia(sentMedia, ticket, ticket.contact, true);
              }
            } catch (error) {
              console.error("Erro ao enviar mídia para Facebook/Instagram:", error);
            }
          }

          // Não remover o arquivo após envio: ele é servido em /public/company<id>/... para exibição no frontend
          // const filePath = path.resolve("public", `company${companyId}`, media.filename);
          // if (fs.existsSync(filePath) && isPrivate === "false") {
          //   fs.unlinkSync(filePath);
          // }
        })
      );
    } else {
      // Se não há conteúdo para enviar, apenas retorna sucesso (ex: marcar como lido)
      if (!body && !vCard) {
        return res.json({ message: "ok" });
      }

      if (ticket.channel === "whatsapp" && isPrivate === "false") {
        // Enviar mensagem
        const sentMessage = await SendWhatsAppMessageUnified({ body, ticket, quotedMsg, vCard });

        // Extrair ID da mensagem (suporta ambos os tipos)
        let messageId: string;
        if ('id' in sentMessage) {
          // IWhatsAppMessage (Official API)
          messageId = sentMessage.id;
        } else if (sentMessage.key?.id) {
          // WebMessageInfo (Baileys)
          messageId = sentMessage.key.id;
        } else {
          // Fallback
          messageId = `${Date.now()}`;
        }

        // Salvar a mensagem no banco para aparecer no chat
        const messageData = {
          wid: messageId,
          ticketId: ticket.id,
          contactId: ticket.contactId,
          body: body || "",
          fromMe: true,
          mediaType: !isNil(vCard) ? "contactMessage" : "extendedTextMessage",
          read: true,
          quotedMsgId: quotedMsg?.id || null,
          ack: 1, // Enviado
          remoteJid: ticket.contact?.remoteJid,
        };

        await CreateMessageService({ messageData, companyId: ticket.companyId });
      } else if (ticket.channel === "whatsapp" && isPrivate === "true") {
        const messageData = {
          wid: `PVT${ticket.updatedAt.toString().replace(" ", "")}`,
          ticketId: ticket.id,
          contactId: undefined,
          body,
          fromMe: true,
          mediaType: !isNil(vCard) ? "contactMessage" : "extendedTextMessage",
          read: true,
          quotedMsgId: null,
          ack: 2,
          remoteJid: ticket.contact?.remoteJid,
          participant: null,
          dataJson: null,
          ticketTrakingId: null,
          isPrivate: isPrivate === "true",
          companyId: ticket.companyId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await CreateMessageService({ messageData, companyId: ticket.companyId });
      } else if (["facebook", "instagram"].includes(ticket.channel)) {
        const sendText = await sendFaceMessage({ body, ticket, quotedMsg });

        if (ticket.channel === "facebook") {
          await verifyMessageFace(sendText, body, ticket, ticket.contact, true);
        }
      }
    }
    return res.status(200).json({ message: "Mensagem enviada com sucesso" });
  } catch (error) {
    console.error("Erro ao armazenar mensagem:", error);
    return res.status(400).json({ error: error.message });
  }
};

// Encaminhar mensagem
export const forwardMessage = async (req: Request, res: Response): Promise<Response> => {
  const { quotedMsg, signMessage, messageId, contactId } = req.body;
  const { id: userId, companyId } = req.user;
  const requestUser = await User.findByPk(userId);

  if (!messageId || !contactId) {
    return res.status(400).json({ message: "MessageId or ContactId not found" });
  }
  const message = await ShowMessageService(messageId);
  const contact = await ShowContactService(contactId, companyId);

  if (!message) {
    return res.status(404).json({ message: "Message not found" });
  }
  if (!contact) {
    return res.status(404).json({ message: "Contact not found" });
  }

  const settings = await CompaniesSettings.findOne({ where: { companyId } });

  const whatsAppConnectionId = await GetWhatsAppFromMessage(message);
  if (!whatsAppConnectionId) {
    return res.status(404).json({ message: "Whatsapp from message not found" });
  }

  const ticket = await ShowTicketService(message.ticketId, message.companyId);

  const mutex = new Mutex();

  const createTicket = await mutex.runExclusive(async () => {
    const result = await FindOrCreateTicketService(
      contact,
      ticket?.whatsapp,
      0,
      ticket.companyId,
      ticket.queueId,
      requestUser!.id,
      contact.isGroup ? contact : null,
      "whatsapp",
      null,
      true,
      settings,
      false,
      false
    );

    return result;
  });

  let ticketData;

  if (isNil(createTicket?.queueId)) {
    ticketData = {
      status: createTicket.isGroup ? "group" : "open",
      userId: requestUser!.id,
      queueId: ticket.queueId,
    };
  } else {
    ticketData = {
      status: createTicket.isGroup ? "group" : "open",
      userId: requestUser!.id,
    };
  }

  await UpdateTicketService({
    ticketData,
    ticketId: createTicket.id,
    companyId: createTicket.companyId,
  });

  let body = message.body;
  if (message.mediaType === "conversation" || message.mediaType === "extendedTextMessage") {
    await SendWhatsAppMessage({ body, ticket: createTicket, quotedMsg, isForwarded: !message.fromMe });
  } else {
    const mediaUrl = message.mediaUrl.replace(`:${process.env.PORT}`, "");
    const fileName = obterNomeEExtensaoDoArquivo(mediaUrl);

    if (body === fileName) {
      body = "";
    }

    const publicFolder = path.resolve(__dirname, "..", "..", "public");
    const filePath = path.join(publicFolder, `company${createTicket.companyId}`, fileName);

    const mediaSrc = {
      fieldname: "medias",
      originalname: fileName,
      encoding: "7bit",
      mimetype: message.mediaType,
      filename: fileName,
      path: filePath,
    } as Express.Multer.File;

    await SendWhatsAppMedia({ media: mediaSrc, ticket: createTicket, body, isForwarded: !message.fromMe });
  }

  return res.status(200).json({ message: "Mensagem encaminhada com sucesso" });
};

// Remover mensagem
export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { messageId } = req.params;
  const { companyId } = req.user;

  const message = await DeleteWhatsAppMessage(messageId, companyId);
  const io = getIO();

  if (message.isPrivate) {
    await Message.destroy({ where: { id: message.id } });
    const ticket = await Ticket.findByPk(message.ticketId, { include: ["contact"] });
    await emitToCompanyRoom(
      companyId,
      ticket.uuid,
      `company-${companyId}-appMessage`,
      {
        action: "delete",
        message,
        ticket,
      }
    );
  }

  const ticketUpd = await Ticket.findByPk(message.ticketId, { include: ["contact"] });
  await emitToCompanyRoom(
    companyId,
    ticketUpd.uuid,
    `company-${companyId}-appMessage`,
    {
      action: "update",
      message,
      ticket: ticketUpd,
    }
  );

  return res.status(200).json({ message: "Mensagem removida com sucesso" });
};

// Contar mensagens
export const allMe = async (req: Request, res: Response): Promise<Response> => {
  const dateStart: any = req.query.dateStart;
  const dateEnd: any = req.query.dateEnd;
  const fromMe: any = req.query.fromMe;
  const { companyId } = req.user;

  const { count } = await ListMessagesServiceAll({
    companyId,
    fromMe,
    dateStart,
    dateEnd,
  });

  return res.json({ count });
};

// Enviar mensagem
export const send = async (req: Request, res: Response): Promise<Response> => {
  const messageData: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new AppError("Token de autorização não fornecido", 401);
    }

    const [, token] = authHeader.split(" ");
    const whatsapp = await Whatsapp.findOne({ where: { token } });
    if (!whatsapp) {
      throw new AppError("Não foi possível realizar a operação", 404);
    }

    const companyId = whatsapp.companyId;
    const company = await ShowPlanCompanyService(companyId);
    const sendMessageWithExternalApi = company.plan.useExternalApi;

    if (!sendMessageWithExternalApi) {
      throw new AppError(
        "Essa empresa não tem permissão para usar a API Externa. Entre em contato com o Suporte para verificar nossos planos!",
        403
      );
    }

    if (messageData.number === undefined) {
      throw new AppError("O número é obrigatório", 400);
    }

    const number = messageData.number;
    const body = messageData.body;

    if (medias) {
      await Promise.all(
        medias.map(async (media: Express.Multer.File) => {
          await req.app.get("queues").messageQueue.add(
            "SendMessage",
            {
              whatsappId: whatsapp.id,
              data: {
                number,
                body: media.originalname.replace("/", "-"),
                mediaPath: media.path,
              },
            },
            { removeOnComplete: true, attempts: 3 }
          );
        })
      );
    } else {
      await req.app.get("queues").messageQueue.add(
        "SendMessage",
        {
          whatsappId: whatsapp.id,
          data: {
            number,
            body,
          },
        },
        { removeOnComplete: true, attempts: 3 }
      );
    }
    return res.status(200).json({ mensagem: "Mensagem enviada!" });
  } catch (err) {
    console.error("Erro ao enviar mensagem:", err);
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    throw new AppError("Não foi possível enviar a mensagem, tente novamente em alguns instantes", 500);
  }
};

// Editar mensagem
export const edit = async (req: Request, res: Response): Promise<Response> => {
  const { messageId } = req.params;
  const { companyId } = req.user;
  const { body }: MessageData = req.body;

  try {
    const { ticket, message } = await EditWhatsAppMessage({ messageId, body });

    const io = getIO();
    io.of(`/workspace-${companyId}`).to(ticket.uuid).emit(`company-${companyId}-appMessage`, {
      action: "update",
      message,
      ticket,
    });

    io.of(`/workspace-${companyId}`).emit(`company-${companyId}-ticket`, {
      action: "update",
      ticket,
    });

    return res.status(200).json({ message: "Mensagem editada com sucesso" });
  } catch (error) {
    console.error("Erro ao editar mensagem:", error);
    throw new AppError("Erro ao editar mensagem", 500);
  }
};

// Enviar mensagem em fluxo
export const sendMessageFlow = async (
  whatsappId: number,
  body: any,
  req: Request,
  files?: Express.Multer.File[]
): Promise<string> => {
  const messageData = body;
  const medias = files;

  try {
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      throw new AppError("Não foi possível realizar a operação", 404);
    }

    if (messageData.number === undefined) {
      throw new AppError("O número é obrigatório", 400);
    }

    const numberToTest = messageData.number;
    const body = messageData.body;
    const companyId = messageData.companyId;

    const CheckValidNumber = await CheckContactNumber(numberToTest, companyId);
    const number = CheckValidNumber.replace(/\D/g, "");

    if (medias) {
      await Promise.all(
        medias.map(async (media: Express.Multer.File) => {
          await req.app.get("queues").messageQueue.add(
            "SendMessage",
            {
              whatsappId,
              data: {
                number,
                body: media.originalname,
                mediaPath: media.path,
              },
            },
            { removeOnComplete: true, attempts: 3 }
          );
        })
      );
    } else {
      await req.app.get("queues").messageQueue.add(
        "SendMessage",
        {
          whatsappId,
          data: {
            number,
            body,
          },
        },
        { removeOnComplete: false, attempts: 3 }
      );
    }

    return "Mensagem enviada";
  } catch (err) {
    console.error("Erro ao enviar mensagem no fluxo:", err);
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError("Não foi possível enviar a mensagem, tente novamente em alguns instantes", 500);
  }
};

/**
 * Encaminhar mensagem para número externo (que pode não estar no CRM)
 * Cria contato se não existir e encaminha a mensagem
 */
export const forwardToExternalNumber = async (req: Request, res: Response): Promise<Response> => {
  const { messageId, number, whatsappId } = req.body;
  const { id: userId, companyId } = req.user;

  if (!messageId || !number) {
    return res.status(400).json({ error: "messageId e number são obrigatórios" });
  }

  try {
    const requestUser = await User.findByPk(userId);
    const message = await ShowMessageService(messageId);

    if (!message) {
      return res.status(404).json({ error: "Mensagem não encontrada" });
    }

    // Normalizar número (remover caracteres especiais)
    const cleanNumber = number.replace(/\D/g, "");

    // Verificar se número é válido
    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
      return res.status(400).json({ error: "Número inválido. Use formato: 5511999999999" });
    }

    // Buscar ou criar contato
    const [contact] = await Contact.findOrCreate({
      where: {
        number: cleanNumber,
        companyId
      },
      defaults: {
        name: `+${cleanNumber}`,
        number: cleanNumber,
        companyId,
        email: "",
        profilePicUrl: ""
      }
    });

    // Buscar WhatsApp para envio
    let whatsapp: Whatsapp;
    if (whatsappId) {
      whatsapp = await Whatsapp.findByPk(whatsappId);
    } else {
      // Usar o mesmo WhatsApp da mensagem original
      const originalTicket = await ShowTicketService(message.ticketId, companyId);
      whatsapp = await Whatsapp.findByPk(originalTicket.whatsappId);
    }

    if (!whatsapp) {
      return res.status(404).json({ error: "Conexão WhatsApp não encontrada" });
    }

    // Buscar settings
    const settings = await CompaniesSettings.findOne({ where: { companyId } });

    // Criar ou buscar ticket para o contato
    const mutex = new Mutex();
    const ticket = await mutex.runExclusive(async () => {
      return await FindOrCreateTicketService(
        contact,
        whatsapp,
        0,
        companyId,
        null, // queueId
        requestUser!.id,
        null, // groupContact
        "whatsapp",
        null,
        true, // isForward
        settings,
        false,
        false
      );
    });

    // Atualizar ticket para aberto
    await UpdateTicketService({
      ticketData: {
        status: "open",
        userId: requestUser!.id
      },
      ticketId: ticket.id,
      companyId
    });

    // Encaminhar mensagem
    let body = message.body;

    if (message.mediaType === "conversation" || message.mediaType === "extendedTextMessage") {
      // Mensagem de texto
      await SendWhatsAppMessage({
        body,
        ticket,
        quotedMsg: null,
        isForwarded: true
      });
    } else if (message.mediaUrl) {
      // Mensagem com mídia
      const publicFolder = path.resolve(__dirname, "..", "..", "public");
      const fileName = message.mediaUrl.split("/").pop() || "arquivo";
      const filePath = path.join(publicFolder, `company${companyId}`, message.mediaUrl);

      // Verificar se arquivo existe
      if (fs.existsSync(filePath)) {
        const mediaSrc = {
          fieldname: "medias",
          originalname: fileName,
          encoding: "7bit",
          mimetype: message.mediaType || "application/octet-stream",
          filename: fileName,
          path: filePath
        } as Express.Multer.File;

        await SendWhatsAppMedia({
          media: mediaSrc,
          ticket,
          body: body !== fileName ? body : "",
          isForwarded: true
        });
      } else {
        // Se arquivo não existe localmente, enviar apenas o texto
        await SendWhatsAppMessage({
          body: body || "[Mídia não disponível]",
          ticket,
          quotedMsg: null,
          isForwarded: true
        });
      }
    } else {
      // Outros tipos (location, contact, etc)
      await SendWhatsAppMessage({
        body,
        ticket,
        quotedMsg: null,
        isForwarded: true
      });
    }

    return res.status(200).json({
      message: "Mensagem encaminhada com sucesso",
      ticketId: ticket.id,
      contactId: contact.id
    });

  } catch (error: any) {
    console.error("[forwardToExternalNumber] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao encaminhar mensagem" });
  }
};

// Sincronização manual de histórico de mensagens
export const syncMessages = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;

  try {
    const result = await SyncChatHistoryService({
      ticketId,
      companyId,
      forceSync: true // Força sync mesmo se throttle ativo
    });

    return res.status(200).json({
      success: !result.skipped,
      synced: result.synced,
      message: result.reason || `${result.synced} mensagens sincronizadas`
    });
  } catch (error: any) {
    console.error("[syncMessages] Erro:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro ao sincronizar mensagens"
    });
  }
};