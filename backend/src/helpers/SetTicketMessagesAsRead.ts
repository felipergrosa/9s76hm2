import { proto, WASocket } from "@whiskeysockets/baileys";
import cacheLayer from "../libs/cache";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import logger from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { markMessagesAsReadByTicket } from "../services/MessageServices/MessageCommandService";

/**
 * Verifica se o socket Baileys está realmente conectado e funcional
 * Não basta verificar o status no banco - precisamos verificar o WebSocket
 */
const isSocketAlive = (wbot: WASocket): boolean => {
  try {
    // @ts-ignore - ws é uma propriedade interna do Baileys, readyState é number
    const ws = wbot?.ws as { readyState?: number } | undefined;
    if (!ws) return false;
    
    // readyState: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
    if (ws.readyState !== 1) {
      logger.debug(`[SetTicketMessagesAsRead] WebSocket não está OPEN (readyState=${ws.readyState})`);
      return false;
    }
    
    // Verificar se tem usuário autenticado
    if (!wbot.user?.id) {
      logger.debug(`[SetTicketMessagesAsRead] Socket sem usuário autenticado`);
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error(`[SetTicketMessagesAsRead] Erro ao verificar socket: ${error.message}`);
    return false;
  }
};

const SetTicketMessagesAsRead = async (ticket: Ticket): Promise<void> => {

  if (ticket.whatsappId) {
    const whatsapp = await ShowWhatsAppService(
      ticket.whatsappId,
      ticket.companyId
    );

    // Zera mensagens não lidas para tickets open, group OU pending (quando usuário abre a conversa)
    if (["open", "group", "pending", "bot", "campaign"].includes(ticket.status) && whatsapp && ticket.unreadMessages > 0) {
      try {
        // Para conexões oficiais, não há Baileys; apenas atualiza banco/cache e emite evento.
        if (whatsapp.channelType === "official") {
          // CQRS: Usar MessageCommandService para marcar como lidas
          await markMessagesAsReadByTicket(ticket.id, ticket.uuid, ticket.companyId);

          await ticket.update({ unreadMessages: 0 });
          await cacheLayer.set(`contacts:${ticket.contactId}:unreads`, "0");

          const io = getIO();
          io.of(`/workspace-${ticket.companyId}`)
            .emit(`company-${ticket.companyId}-ticket`, {
              action: "updateUnread",
              ticketId: ticket.id
            });

          return;
        }

        // Conexões Baileys (Web) - tenta marcar mensagens remotamente, mas não bloqueia se falhar
        if (whatsapp.status === 'CONNECTED') {
          try {
            const wbot = await GetTicketWbot(ticket);
            
            // CRÍTICO: Verificar se o socket está realmente vivo antes de usar
            if (!isSocketAlive(wbot)) {
              logger.warn(`[SetTicketMessagesAsRead] Socket não está vivo para whatsappId=${ticket.whatsappId}, pulando readMessages`);
            } else {
              const getJsonMessage = await Message.findAll({
                where: {
                  ticketId: ticket.id,
                  fromMe: false,
                  read: false
                },
                order: [["createdAt", "DESC"]]
              });

              if (getJsonMessage.length > 0) {
                // Usar for...of em vez de forEach para permitir await adequado
                for (const message of getJsonMessage) {
                  try {
                    const msg: proto.IWebMessageInfo = JSON.parse(message.dataJson);
                    if (msg.key && msg.key.fromMe === false && !ticket.isBot && (ticket.userId || ticket.isGroup)) {
                      // Verificar se socket ainda está vivo antes de CADA mensagem
                      if (!isSocketAlive(wbot)) {
                        logger.debug(`[SetTicketMessagesAsRead] Socket morreu durante iteração, parando`);
                        break;
                      }
                      await wbot.readMessages([msg.key]);
                    }
                  } catch (readErr: any) {
                    // Ignorar erro de Connection Closed - socket pode ter morrido durante a iteração
                    if (readErr?.message?.includes('Connection Closed')) {
                      logger.debug(`[SetTicketMessagesAsRead] Connection Closed ao marcar mensagem como lida, parando`);
                      break;
                    } else {
                      logger.warn(`[SetTicketMessagesAsRead] Erro ao marcar mensagem como lida: ${readErr?.message}`);
                    }
                  }
                }
              }
            }
          } catch (err) {
            logger.warn(
              `Could not mark messages as read on WhatsApp. Session may be disconnected: ${err}`
            );
            // Continua para atualizar o banco e emitir evento mesmo se falhar no WhatsApp
          }
        }

        // CQRS: Usar MessageCommandService para marcar como lidas
        // Isso já faz: update no banco + invalida cache + emite evento via EventBus
        await markMessagesAsReadByTicket(ticket.id, ticket.uuid, ticket.companyId);

        await ticket.update({ unreadMessages: 0 });
        await cacheLayer.set(`contacts:${ticket.contactId}:unreads`, "0");

        const io = getIO();

        // Emitir evento de atualização do ticket (ainda necessário para updateUnread do ticket)
        logger.info(`[SetTicketMessagesAsRead] Emitindo updateUnread para ticketId=${ticket.id}`);
        io.of(`/workspace-${ticket.companyId}`)
          .emit(`company-${ticket.companyId}-ticket`, {
            action: "updateUnread",
            ticketId: ticket.id
          });

        // Evento updateRead já é emitido pelo MessageCommandService via EventBus

      } catch (err) {
        logger.warn(
          `Could not update unread messages in database: ${err}`
        );
      }
    }
  }

};

export default SetTicketMessagesAsRead;
