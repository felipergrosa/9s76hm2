import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";
import { Op } from "sequelize";
import { intersection } from "lodash";
import User from "../../models/User";
import isQueueIdHistoryBlocked from "../UserServices/isQueueIdHistoryBlocked";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import SyncChatHistoryService from "./SyncChatHistoryService";
import logger from "../../utils/logger";
import { getCachedTicketMessages, cacheTicketMessages } from "./MessageCacheService";

interface Request {
  ticketId: string;
  companyId: number;
  pageNumber?: string;
  queues?: number[];
  user?: User;
}

interface Response {
  messages: Message[];
  ticket: Ticket;
  count: number;
  hasMore: boolean;
}

const ListMessagesService = async ({
  pageNumber = "1",
  ticketId,
  companyId,
  queues = [],
  user
}: Request): Promise<Response> => {


  if (!isNaN(Number(ticketId))) {
    const uuid = await Ticket.findOne({
      where: {
        id: ticketId,
        companyId
      },
      attributes: ["uuid"]
    });
    ticketId = uuid.uuid;
  }
  const ticket = await Ticket.findOne({
    where: {
      uuid: ticketId,
      companyId
    }
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  const ticketsFilter: any[] | null = [];

  const isAllHistoricEnabled = await isQueueIdHistoryBlocked({ userRequest: user.id });

  let ticketIds = [];
  if (!isAllHistoricEnabled) {
    ticketIds = await Ticket.findAll({
      where:
      {
        id: { [Op.lte]: ticket.id },
        companyId: ticket.companyId,
        contactId: ticket.contactId,
        whatsappId: ticket.whatsappId,
        isGroup: ticket.isGroup,
        queueId: user.profile === "admin" || user.allTicket === "enable" || (ticket.isGroup && user.allowGroup) ?
          {
            [Op.or]: [queues, null]
          } :
          { [Op.in]: queues },
      },
      attributes: ["id"]
    });
  } else {
    ticketIds = await Ticket.findAll({
      where:
      {
        id: { [Op.lte]: ticket.id },
        companyId: ticket.companyId,
        contactId: ticket.contactId,
        whatsappId: ticket.whatsappId,
        isGroup: ticket.isGroup
      },
      attributes: ["id"]
    });
  }

  if (ticketIds) {
    ticketsFilter.push(ticketIds.map(t => t.id));
  }
  // }

  const tickets: number[] = intersection(...ticketsFilter);

  if (!tickets) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  // await setMessagesAsRead(ticket);
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  // Verificar cache apenas para página 1 (mensagens mais recentes)
  if (+pageNumber === 1) {
    const cached = await getCachedTicketMessages(companyId, ticket.id, 1);
    if (cached) {
      logger.debug(`[ListMessages] Cache HIT para ticket ${ticket.id}`);
      return {
        messages: cached.messages as any,
        ticket,
        count: cached.count,
        hasMore: cached.hasMore
      };
    }
  }

  const { count, rows: messages } = await Message.findAndCountAll({
    where: { ticketId: tickets, companyId },
    attributes: ["id", "fromMe", "mediaUrl", "body", "mediaType", "ack", "createdAt", "ticketId", "isDeleted", "queueId", "isForwarded", "isEdited", "isPrivate", "companyId", "dataJson", "audioTranscription"],
    limit,
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: [
          "id",
          "name",
          // needed for avatar rendering on frontend
          "profilePicUrl",
          "urlPicture",
          // required so Contact.urlPicture getter can build full URL with cache buster
          "updatedAt",
          "companyId"
        ],
      },
      {
        model: Message,
        attributes: ["id", "fromMe", "mediaUrl", "body", "mediaType", "companyId", "audioTranscription"],
        as: "quotedMsg",
        include: [
          {
            model: Contact,
            as: "contact",
            attributes: [
              "id",
              "name",
              // needed for avatar rendering on frontend (quoted messages)
              "profilePicUrl",
              "urlPicture",
              // required so Contact.urlPicture getter can build full URL with cache buster
              "updatedAt",
              "companyId"
            ],
          }
        ],
        required: false
      },
      {
        model: Ticket,
        required: true,
        attributes: ["id", "whatsappId", "queueId", "createdAt"],
        include: [
          {
            model: Queue,
            as: "queue",
            attributes: ["id", "name", "color"]
          }
        ],
      }
    ],
    distinct: true,
    offset,
    subQuery: false,
    order: [["createdAt", "DESC"]]
  });

  let hasMore = count > offset + messages.length;

  // Armazenar página 1 no cache para acessos futuros
  if (+pageNumber === 1 && messages.length > 0) {
    cacheTicketMessages(companyId, ticket.id, 1, messages as any, count, hasMore).catch(() => {});
  }

  // INFINITE SCROLL: Se não há mais mensagens locais e estamos em página > 1,
  // tenta buscar mais mensagens do WhatsApp
  if (!hasMore && +pageNumber > 1 && ticket.channel === "whatsapp" && ticket.whatsappId) {
    try {
      // Verificar se a conexão suporta sync on-demand
      const whatsapp = await Whatsapp.findByPk(ticket.whatsappId, {
        attributes: ["id", "status", "syncOnTicketOpen"]
      });

      if (whatsapp?.status === "CONNECTED") {
        logger.info(`[ListMessages] Histórico local esgotou, buscando mais do WhatsApp para ticketId=${ticket.id}`);

        // Chamar sync para buscar mensagens mais antigas
        const syncResult = await SyncChatHistoryService({
          ticketId: ticket.id,
          companyId,
          messageCount: 50, // Buscar mais mensagens de uma vez
          forceSync: true   // Ignorar throttle pois é paginação
        });

        // Se sincronizou novas mensagens, refazer a query
        if (syncResult.synced > 0) {
          logger.info(`[ListMessages] Sincronizadas ${syncResult.synced} mensagens, refazendo query`);

          const { count: newCount, rows: newMessages } = await Message.findAndCountAll({
            where: { ticketId: tickets, companyId },
            attributes: ["id", "fromMe", "mediaUrl", "body", "mediaType", "ack", "createdAt", "ticketId", "isDeleted", "queueId", "isForwarded", "isEdited", "isPrivate", "companyId", "dataJson", "audioTranscription"],
            limit,
            include: [
              {
                model: Contact,
                as: "contact",
                attributes: ["id", "name", "profilePicUrl", "urlPicture", "updatedAt", "companyId"],
              },
              {
                model: Message,
                attributes: ["id", "fromMe", "mediaUrl", "body", "mediaType", "companyId", "audioTranscription"],
                as: "quotedMsg",
                include: [
                  {
                    model: Contact,
                    as: "contact",
                    attributes: ["id", "name", "profilePicUrl", "urlPicture", "updatedAt", "companyId"],
                  }
                ],
                required: false
              },
              {
                model: Ticket,
                required: true,
                attributes: ["id", "whatsappId", "queueId", "createdAt"],
                include: [
                  {
                    model: Queue,
                    as: "queue",
                    attributes: ["id", "name", "color"]
                  }
                ],
              }
            ],
            distinct: true,
            offset,
            subQuery: false,
            order: [["createdAt", "DESC"]]
          });

          // Atualizar hasMore com base nos novos dados
          hasMore = newCount > offset + newMessages.length;

          return {
            messages: newMessages.reverse(),
            ticket,
            count: newCount,
            hasMore
          };
        }
      }
    } catch (syncError: any) {
      // Não falhar a listagem por erro no sync
      logger.warn(`[ListMessages] Erro no sync on-demand: ${syncError?.message}`);
    }
  }

  return {
    messages: messages.reverse(),
    ticket,
    count,
    hasMore
  };
};

export default ListMessagesService;