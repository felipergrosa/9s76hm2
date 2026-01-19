import { WASocket, WAMessage } from "@whiskeysockets/baileys";
import axios from "axios";
import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import GetWbotMessage from "../../helpers/GetWbotMessage";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";

import formatBody from "../../helpers/Mustache";

interface Request {
  messageId: string;
  body: string;
}

/**
 * Edita mensagem via API Oficial do WhatsApp
 * Nota: A API Oficial NÃO suporta edição de mensagens enviadas.
 * Esta função apenas atualiza o registro local no banco de dados.
 */
const editMessageOfficialAPI = async (
  message: Message,
  ticket: Ticket,
  whatsapp: Whatsapp,
  newBody: string
): Promise<void> => {
  // A API Oficial do WhatsApp NÃO suporta edição de mensagens
  // Apenas atualizamos o registro local
  logger.warn(`[EditMessage] API Oficial não suporta edição de mensagens. Atualizando apenas localmente.`);

  // Podemos tentar enviar uma nova mensagem indicando a correção
  // Mas por enquanto, apenas atualizamos o banco local
};

/**
 * Edita mensagem via Baileys (WhatsApp Web)
 */
const editMessageBaileys = async (
  message: Message,
  ticket: Ticket,
  newBody: string
): Promise<void> => {
  const wbot = await GetTicketWbot(ticket);

  // Validar que temos dataJson
  if (!message.dataJson) {
    throw new AppError("Mensagem não possui dados originais (dataJson). Não é possível editar.");
  }

  let msg: any;
  try {
    msg = JSON.parse(message.dataJson);
  } catch (e) {
    throw new AppError("Falha ao parsear dataJson da mensagem.");
  }

  // Validar que temos a key completa
  if (!msg.key || !msg.key.id) {
    throw new AppError("Mensagem não possui key válida. Não é possível editar.");
  }

  // Usar o remoteJid do key (mais confiável que message.remoteJid)
  const targetJid = msg.key.remoteJid || message.remoteJid;

  if (!targetJid) {
    throw new AppError("Não foi possível determinar o destinatário da mensagem.");
  }

  logger.info(`[EditMessage] Editando mensagem - targetJid: ${targetJid}, keyId: ${msg.key.id}, fromMe: ${msg.key.fromMe}`);

  // Garantir que a key tem fromMe=true (só podemos editar mensagens enviadas por nós)
  const editKey = {
    ...msg.key,
    remoteJid: targetJid,
    fromMe: true // Forçar fromMe=true para edição
  };

  await wbot.sendMessage(targetJid, {
    text: newBody,
    edit: editKey
  });

  logger.info(`[EditMessage] Mensagem enviada para edição via Baileys`);
};

const EditWhatsAppMessage = async ({
  messageId,
  body,
}: Request): Promise<{ ticket: Ticket, message: Message }> => {

  const message = await Message.findByPk(messageId, {
    include: [
      {
        model: Ticket,
        as: "ticket",
        include: ["contact", "whatsapp"]
      }
    ]
  });

  if (!message) {
    throw new AppError("No message found with this ID.");
  }

  if (!message.fromMe) {
    throw new AppError("Só é possível editar mensagens enviadas por você.");
  }

  const { ticket } = message;
  const whatsapp = ticket.whatsapp;

  if (!whatsapp) {
    throw new AppError("Conexão WhatsApp não encontrada.");
  }

  try {
    // Verificar se é API Oficial ou Baileys
    // API Oficial tem wabaPhoneNumberId ou channelType === "official"
    const isOfficialAPI = whatsapp.channelType === "official" ||
      !!whatsapp.wabaPhoneNumberId;

    if (isOfficialAPI) {
      // API Oficial não suporta edição - apenas atualiza localmente
      await editMessageOfficialAPI(message, ticket, whatsapp, body);
      logger.info(`[EditMessage] Mensagem ${messageId} atualizada localmente (API Oficial não suporta edição real)`);
    } else {
      // Baileys - edição real via WhatsApp Web
      await editMessageBaileys(message, ticket, body);
      logger.info(`[EditMessage] Mensagem ${messageId} editada via Baileys`);
    }

    // Atualizar registro no banco de dados
    await message.update({ body, isEdited: true });
    await ticket.update({ lastMessage: body });
    await ticket.reload();

    // Recarregar mensagem com todas as associações
    await message.reload({
      include: [
        {
          model: Ticket,
          as: "ticket",
          include: ["contact", "whatsapp"]
        }
      ]
    });

    return { ticket: message.ticket, message };
  } catch (err: any) {
    logger.error(`[EditMessage] Erro ao editar mensagem ${messageId}:`, err);

    // Se for erro de Baileys, pode ser que a mensagem seja muito antiga
    if (err.message?.includes("not-authorized") || err.message?.includes("item-not-found")) {
      throw new AppError("Não foi possível editar: mensagem muito antiga ou não encontrada no WhatsApp.");
    }

    throw new AppError(err.message || "Erro ao editar mensagem");
  }
};

export default EditWhatsAppMessage;
