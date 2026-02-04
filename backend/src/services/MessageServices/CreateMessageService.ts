import { getIO } from "../../libs/socket";
import { emitToCompanyRoom } from "../../libs/socketEmit";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";

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
  // BLINDAGEM: Validação de integridade ticket/contact
  // Log para debugging de mensagens cruzadas
  if (messageData.contactId && messageData.ticketId) {
    const ticketCheck = await Ticket.findByPk(messageData.ticketId, { attributes: ["id", "contactId"] });
    if (ticketCheck && ticketCheck.contactId !== messageData.contactId) {
      logger.error("[CreateMessageService] ALERTA DE INTEGRIDADE: ticket.contactId !== messageData.contactId", {
        ticketId: messageData.ticketId,
        ticketContactId: ticketCheck.contactId,
        messageContactId: messageData.contactId,
        wid: messageData.wid,
        companyId
      });
    }
  }

  await Message.upsert({ ...messageData, companyId });

  const message = await Message.findOne({
    where: {
      wid: messageData.wid,
      companyId
    },
    include: [
      "contact",
      {
        model: Ticket,
        as: "ticket",
        include: [
          {
            model: Contact,
            attributes: ["id", "name", "number", "email", "profilePicUrl", "acceptAudioMessage", "active", "urlPicture", "companyId"],
            include: ["extraInfo", "tags"]
          },
          {
            model: Queue,
            attributes: ["id", "name", "color"]
          },
          {
            model: Whatsapp,
            attributes: ["id", "name", "groupAsTicket"]
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
        ]
      },
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ]
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

  // Atualizar lastMessage do ticket (para exibir preview na lista)
  // Não atualizar se for mensagem privada
  if (!message.isPrivate && message.body) {
    await message.ticket.update({
      lastMessage: message.body,
      updatedAt: new Date()
    });
  }

  const io = getIO();

  // Se é campanha, NÃO emite nada (evita aparecer na tela do atendente)
  // A mensagem será visível apenas ao abrir o ticket específico
  if (!messageData?.ticketImported) {
    const roomId = message.ticket.uuid;
    const eventName = `company-${companyId}-appMessage`;
    
    console.log(`[CreateMessageService] Emitindo mensagem para sala ${roomId}, companyId=${companyId}, msgId=${message.id}, ticketId=${message.ticketId}`);
    
    // Tentativa com retry para problemas intermitentes
    const emitWithRetry = async (attempts: number = 3, delayMs: number = 100): Promise<void> => {
      for (let i = 0; i < attempts; i++) {
        try {
          await emitToCompanyRoom(
            companyId,
            roomId,
            eventName,
            {
              action: "create",
              message,
              ticket: message.ticket,
              contact: message.ticket.contact
            },
            false // Habilitar fallback para garantir entrega mesmo se sala vazia
          );
          console.log(`[CreateMessageService] Emissão sucesso na tentativa ${i + 1} para sala ${roomId}`);
          return;
        } catch (err) {
          console.error(`[CreateMessageService] Falha na tentativa ${i + 1} de emissão para sala ${roomId}:`, err);
          if (i < attempts - 1) {
            await new Promise(r => setTimeout(r, delayMs * (i + 1)));
          }
        }
      }
      console.error(`[CreateMessageService] Todas as tentativas de emissão falharam para sala ${roomId}`);
    };
    
    await emitWithRetry();
  }


  return message;
};

export default CreateMessageService;
