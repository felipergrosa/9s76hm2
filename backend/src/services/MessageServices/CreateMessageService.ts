import { getIO } from "../../libs/socket";
import { emitToCompanyRoom } from "../../libs/socketEmit";
import { emitSocketEvent } from "../../queues/socketEventQueue";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import { invalidateTicketMessagesCache } from "./MessageCacheService";

export interface MessageData {
  wid: string;
  ticketId: number;
  body: string;
  contactId?: number;
  fromMe?: boolean;
  read?: boolean;
  mediaType?: string;
  mediaUrl?: string;
  ack?: number;
  quotedMsgId?: string | number | null;
  queueId?: number;
  channel?: string;
  ticketTrakingId?: number;
  isPrivate?: boolean;
  ticketImported?: any;
  isForwarded?: boolean;
  remoteJid?: string | null;
  dataJson?: string;
  isCampaign?: boolean; // Se true, não emite para a sala da conversa (background)
  senderName?: string; // Nome do remetente em mensagens de grupo
}
interface Request {
  messageData: MessageData;
  companyId: number;
}

const CreateMessageService = async ({
  messageData,
  companyId
}: Request): Promise<Message> => {
  // =================================================================
  // DEDUPLICAÇÃO MULTI-DEVICE: Verificar se mensagem já existe
  // =================================================================
  // Com múltiplas conexões do mesmo número, a mesma mensagem pode chegar
  // em múltiplas conexões. Precisamos garantir que apenas uma seja salva.
  const existingMessage = await Message.findOne({
    where: {
      wid: messageData.wid,
      companyId
    },
    attributes: ["id", "wid", "ticketId"]
  });

  if (existingMessage) {
    logger.debug(`[CreateMessageService] Mensagem já existe (deduplicada): wid=${messageData.wid}, id=${existingMessage.id}`);
    return existingMessage;
  }
  // =================================================================

  // BLINDAGEM: Validação e correção de integridade ticket/contact
  if (messageData.contactId && messageData.ticketId) {
    const ticketCheck = await Ticket.findByPk(messageData.ticketId, { attributes: ["id", "contactId"] });
    if (ticketCheck && ticketCheck.contactId !== messageData.contactId) {
      logger.warn("[CreateMessageService] Corrigindo contactId inconsistente", {
        ticketId: messageData.ticketId,
        ticketContactId: ticketCheck.contactId,
        messageContactId: messageData.contactId,
        wid: messageData.wid,
        companyId
      });
      // Corrigir: usar o contactId do ticket (fonte de verdade)
      messageData.contactId = ticketCheck.contactId;
    }
  }

  await Message.upsert({ ...messageData, companyId });

  const message = await Message.findOne({
    where: {
      wid: messageData.wid,
      companyId,
      ticketId: messageData.ticketId
    },
    include: [
      // Apenas os campos usados pelo frontend no payload do socket
      // (nome/avatar/id). Evita puxar todas as colunas do contato por mensagem.
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number", "profilePicUrl", "urlPicture", "isGroup", "companyId"]
      },
      {
        model: Ticket,
        as: "ticket",
        include: [
          {
            model: Contact,
            attributes: ["id", "name", "number", "email", "profilePicUrl", "acceptAudioMessage", "active", "urlPicture", "companyId"],
            // "extraInfo" removido: não é consumido nos eventos de socket
            // (ContactDrawer rebusca o contato via REST). "tags" é usado
            // pelo store de tickets em tempo real.
            include: ["tags"]
          },
          {
            model: Queue,
            attributes: ["id", "name", "color"]
          },
          {
            model: Whatsapp,
            attributes: ["id", "name", "groupAsTicket", "color"]
          },

          {
            model: User,
            attributes: ["id", "name"]
          },
          {
            model: Tag,
            as: "tags",
            attributes: ["id", "name", "color"]
          }
        ],
        // CRÍTICO: Incluir unreadMessages para notificações funcionarem
        attributes: ["id", "uuid", "status", "unreadMessages", "userId", "queueId", "isGroup", "lastMessage", "companyId", "whatsappId"]
      },
      {
        model: Message,
        as: "quotedMsg",
        // Frontend usa apenas nome/avatar/id do contato da mensagem citada
        include: [
          {
            model: Contact,
            as: "contact",
            attributes: ["id", "name", "number", "profilePicUrl", "urlPicture", "isGroup"]
          }
        ]
      }
    ],
    // CRÍTICO: Incluir quotedMsgId para reações poderem ser associadas à mensagem correta
    attributes: { include: ["quotedMsgId"] }
  });

  if (message.ticket.queueId !== null && message.queueId === null) {
    await message.update({ queueId: message.ticket.queueId });
  }

  if (message.isPrivate) {
    await message.update({ wid: `PVT${message.id}` });
  }

  if (!message) {
    throw new Error("ERR_CREATING_MESSAGE");
  }

  // Invalidar cache de mensagens do ticket (nova mensagem chegou)
  // CRÍTICO: aguardar invalidação ANTES de emitir para evitar race condition
  // onde o frontend carrega cache stale e sobrescreve a mensagem recebida via Socket
  try {
    await invalidateTicketMessagesCache(companyId, message.ticketId);
  } catch (err) {
    logger.debug("[CreateMessageService] Erro ao invalidar cache (não crítico):", err);
  }

  // Atualizar lastMessage do ticket (para exibir preview na lista)
  // Não atualizar se for mensagem privada
  if (!message.isPrivate && message.body) {
    await message.ticket.update({
      lastMessage: message.body,
      updatedAt: new Date()
    });
  }

  // NOTA: reload() removido — era um SELECT redundante por mensagem.
  // A instância já reflete os campos atualizados acima (lastMessage/updatedAt)
  // e unreadMessages já vinha fresco do findOne pós-upsert: FindOrCreateTicketService
  // comita o incremento ANTES desta consulta. Manter reload não eliminava a race
  // com mensagens concorrentes (o SELECT tinha a mesma janela).

  const io = getIO();

  // Se é campanha, NÃO emite nada (evita aparecer na tela do atendente)
  // A mensagem será visível apenas ao abrir o ticket específico
  // NOTA: Mensagens importadas (ticketImported) DEVEM ser emitidas para atualizar o chat
  if (!messageData?.isCampaign) {
    const roomId = message.ticket.uuid;
    const eventName = `company-${companyId}-appMessage`;
    const payload = {
      action: "create",
      message,
      ticket: message.ticket,
      contact: message.ticket.contact
    };
    
    logger.debug(`[CreateMessageService] Emitindo mensagem para sala ${roomId}, companyId=${companyId}, msgId=${message.id}, ticketId=${message.ticketId}, imported=${!!messageData?.ticketImported}`);
    
    // Usa fila persistente se SOCKET_USE_QUEUE=true (mais robusto)
    // Caso contrário, usa emissão direta com retry
    try {
      await emitSocketEvent(companyId, roomId, eventName, payload);
      logger.debug(`[CreateMessageService] Emissão concluída para sala ${roomId}`);
    } catch (err) {
      logger.error(`[CreateMessageService] Falha na emissão para sala ${roomId}: ${err}`);
    }
  }


  return message;
};

export default CreateMessageService;
