import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import User from "../../models/User";
import { Op } from "sequelize";
import CacheManager from "../../helpers/CacheManager";

interface Request {
  ticketId: string;
  companyId: number;
  pageNumber?: string;
  user?: User;
}

interface Response {
  messages: Message[];
  ticket: Ticket;
  count: number;
  hasMore: boolean;
}

/**
 * VERSÃO OTIMIZADA - Elimina N+1 queries e usa cache
 */
const ListMessagesServiceOptimized = async ({
  pageNumber = "1",
  ticketId,
  companyId,
  user
}: Request): Promise<Response> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  // Cache key para mensagens do ticket
  const cacheKey = `messages:ticket:${ticketId}:page:${pageNumber}`;
  
  // Tenta buscar do cache primeiro
  const cached = await CacheManager.get<Response>(cacheKey);
  if (cached) {
    console.log(`[ListMessages] Cache HIT: ${cacheKey}`);
    return cached;
  }

  console.log(`[ListMessages] Cache MISS: ${cacheKey}`);

  // Converte ticketId numérico para UUID se necessário
  if (!isNaN(Number(ticketId))) {
    const ticket = await Ticket.findOne({
      where: { id: ticketId, companyId },
      attributes: ["uuid"]
    });
    if (!ticket) throw new AppError("ERR_NO_TICKET_FOUND", 404);
    ticketId = ticket.uuid;
  }

  // Busca ticket com TODOS os relacionamentos de uma vez (evita N+1)
  const ticket = await Ticket.findOne({
    where: { uuid: ticketId, companyId },
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number", "profilePicUrl", "isGroup"]
      },
      {
        model: Queue,
        as: "queue",
        attributes: ["id", "name", "color"]
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name", "status"]
      },
      {
        model: User,
        as: "user",
        attributes: ["id", "name"]
      }
    ]
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  // Determina quais tickets buscar mensagens
  let ticketIds = [ticket.id];

  // Para grupos: buscar mensagens de todos os tickets do mesmo contato
  if (ticket.isGroup) {
    const groupTickets = await Ticket.findAll({
      where: {
        contactId: ticket.contactId,
        companyId: ticket.companyId,
        isGroup: true
      },
      attributes: ["id"]
    });
    ticketIds = groupTickets.map(t => t.id);
  }

  // Conta total de mensagens
  const count = await Message.count({
    where: { ticketId: { [Op.in]: ticketIds } }
  });

  const hasMore = count > offset + limit;

  // Busca mensagens com EAGER LOADING (evita N+1)
  const messages = await Message.findAll({
    where: { ticketId: { [Op.in]: ticketIds } },
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number", "profilePicUrl"]
      },
      {
        model: Message,
        as: "quotedMsg",
        attributes: ["id", "body", "mediaType"],
        include: [
          {
            model: Contact,
            as: "contact",
            attributes: ["name"]
          }
        ]
      }
    ]
  });

  const response: Response = {
    messages: messages.reverse(), // Inverte para ordem cronológica
    ticket,
    count,
    hasMore
  };

  // Salva no cache por 30 segundos (TTL curto para dados em tempo real)
  await CacheManager.set(cacheKey, response, 30);

  return response;
};

export default ListMessagesServiceOptimized;
