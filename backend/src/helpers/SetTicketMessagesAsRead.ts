import { proto, WASocket } from "@whiskeysockets/baileys";
import cacheLayer from "../libs/cache";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import logger from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { markMessagesAsReadByTicket } from "../services/MessageServices/MessageCommandService";

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
            const getJsonMessage = await Message.findAll({
              where: {
                ticketId: ticket.id,
                fromMe: false,
                read: false
              },
              order: [["createdAt", "DESC"]]
            });

            if (getJsonMessage.length > 0) {
              getJsonMessage.forEach(async message => {
                const msg: proto.IWebMessageInfo = JSON.parse(message.dataJson);
                if (msg.key && msg.key.fromMe === false && !ticket.isBot && (ticket.userId || ticket.isGroup)) {
                  await wbot.readMessages([msg.key]);
                }
              });
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
