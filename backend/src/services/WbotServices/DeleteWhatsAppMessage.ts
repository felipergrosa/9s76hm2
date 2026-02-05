import { proto, WASocket } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import GetWbotMessage from "../../helpers/GetWbotMessage";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import logger from "../../utils/logger";

const DeleteWhatsAppMessage = async (messageId: string, companyId?: string | number): Promise<Message> => {
  const message = await Message.findOne({
    where: {
      id: messageId,
      companyId
    },
    include: [
      {
        model: Ticket,
        as: "ticket",
        include: ["contact"]
      }
    ]
  });

  if (!message) {
    throw new AppError("No message found with this ID.");
  }

  const { ticket } = message;

  if (!message.isPrivate) {
    try {
      const wbot = await GetTicketWbot(ticket);
      
      // Tentar obter a key do dataJson
      let msgKey: any = null;
      
      if (message.dataJson) {
        try {
          const parsed = JSON.parse(message.dataJson);
          if (parsed.key && parsed.key.id) {
            msgKey = parsed.key;
          }
        } catch (e) {
          logger.warn(`[DeleteMessage] Falha ao parsear dataJson, tentando reconstruir key`);
        }
      }

      // Se não conseguiu obter do dataJson, reconstruir a key
      if (!msgKey) {
        if (!message.wid) {
          throw new AppError("Mensagem não possui identificador (wid). Não é possível deletar.");
        }

        // Reconstruir a key com os dados disponíveis
        const remoteJid = message.remoteJid || 
          (ticket.contact?.remoteJid) ||
          `${ticket.contact?.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;

        msgKey = {
          remoteJid: remoteJid,
          fromMe: message.fromMe,
          id: message.wid,
          participant: message.participant || undefined
        };

        logger.info(`[DeleteMessage] Key reconstruída: ${JSON.stringify(msgKey)}`);
      }

      // Garantir que temos remoteJid
      const targetJid = msgKey.remoteJid || message.remoteJid;
      if (!targetJid) {
        throw new AppError("Não foi possível determinar o destinatário da mensagem.");
      }

      // Atualizar remoteJid na key se necessário
      msgKey.remoteJid = targetJid;

      logger.info(`[DeleteMessage] Deletando mensagem - targetJid: ${targetJid}, keyId: ${msgKey.id}`);

      await (wbot as WASocket).sendMessage(targetJid, {
        delete: msgKey
      });

      logger.info(`[DeleteMessage] Mensagem deletada via Baileys`);
    } catch (err: any) {
      logger.error(`[DeleteMessage] Erro ao deletar mensagem:`, err);
      throw new AppError("ERR_DELETE_WAPP_MSG");
    }
  }

  if (!message.isPrivate) {
    await message.update({ isDeleted: true });
  }
  
  return message;
};

export default DeleteWhatsAppMessage;
