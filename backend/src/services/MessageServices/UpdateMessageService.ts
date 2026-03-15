import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { getIO } from "../../libs/socket";
import logger from "../../utils/logger";
import { WAMessageUpdate } from "@whiskeysockets/baileys";

/**
 * Atualiza mensagem com dados de edição ou deleção do Baileys v7
 */
interface UpdateMessageParams {
  messageUpdate: WAMessageUpdate;
  companyId: number;
}

interface UpdateMessageResult {
  updated: boolean;
  message?: Message;
  reason?: string;
}

const UpdateMessageService = async ({
  messageUpdate,
  companyId
}: UpdateMessageParams): Promise<UpdateMessageResult> => {
  try {
    const { key, update } = messageUpdate;

    if (!key?.id) {
      return { updated: false, reason: "Message key.id missing" };
    }

    // Buscar mensagem no banco
    const message = await Message.findOne({
      where: {
        wid: key.id,
        companyId
      },
      include: [{ model: Ticket, as: "ticket" }]
    });

    if (!message) {
      logger.debug(`[UpdateMessage] Mensagem não encontrada: wid=${key.id}`);
      return { updated: false, reason: "Message not found" };
    }

    let wasUpdated = false;
    const updateData: any = {};

    // 1. EDIÇÃO DE MENSAGEM
    // Baileys v7: mensagens editadas vêm via update.message com messageStubType
    if (update.message && (update.message as any).editedMessageTimestamp) {
      const editedContent = update.message;
      
      // Extrair novo texto
      let newBody = "";
      if ((editedContent as any).conversation) {
        newBody = (editedContent as any).conversation;
      } else if ((editedContent as any).extendedTextMessage?.text) {
        newBody = (editedContent as any).extendedTextMessage.text;
      }

      if (newBody && newBody !== message.body) {
        updateData.body = newBody;
        updateData.isEdited = true;
        updateData.editedTimestamp = (editedContent as any).editedMessageTimestamp || Date.now();
        wasUpdated = true;
        
        logger.info(`[UpdateMessage] Mensagem editada: wid=${key.id}, nova body="${newBody.substring(0, 50)}..."`);
      }
    }

    // 2. DELEÇÃO DE MENSAGEM
    // Baileys v7: protocolMessage type 0 = DELETE
    if (update.message === null || (update.message as any)?.protocolMessage?.type === 0) {
      updateData.isDeleted = true;
      updateData.body = ""; // Limpar conteúdo
      wasUpdated = true;
      
      logger.info(`[UpdateMessage] Mensagem deletada: wid=${key.id}`);
    }

    // 3. REAÇÃO
    // Baileys v7: reações vêm via update com campo específico
    const updateAny = update as any;
    if (updateAny.reactions && Array.isArray(updateAny.reactions) && updateAny.reactions.length > 0) {
      // Processar reações (pode ter múltiplas)
      const reactions = updateAny.reactions.map((reaction: any) => ({
        emoji: reaction.text || reaction.emoji,
        fromMe: Boolean(reaction.key?.fromMe),
        timestamp: reaction.senderTimestampMs || Date.now()
      }));

      updateData.reactions = reactions;
      wasUpdated = true;

      logger.info(`[UpdateMessage] Reações atualizadas: wid=${key.id}, reactions=${JSON.stringify(reactions)}`);
    }

    if (!wasUpdated) {
      return { updated: false, reason: "No relevant updates" };
    }

    // Atualizar no banco
    await message.update(updateData);

    // Notificar frontend via Socket.IO
    const io = getIO();
    const ticket = message.ticket;

    if (ticket) {
      io.of(`/company-${companyId}-mainchannel`)
        .to(`company-${companyId}-mainchannel`)
        .to(ticket.id.toString())
        .to(ticket.status)
        .emit(`company-${companyId}-appMessage`, {
          action: "update",
          message,
          ticket
        });
    }

    return {
      updated: true,
      message
    };

  } catch (err: any) {
    logger.error(`[UpdateMessage] Erro ao atualizar mensagem: ${err.message}`);
    throw err;
  }
};

export default UpdateMessageService;
