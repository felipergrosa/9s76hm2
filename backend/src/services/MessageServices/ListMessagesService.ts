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
import ImportContactHistoryService from "./ImportContactHistoryService";
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

const enrichGroupParticipantContacts = async ({
  messages,
  companyId
}: {
  messages: any[];
  companyId: number;
}): Promise<void> => {
  const participantJids = messages
    .filter(message => !message.fromMe && message.participant)
    .map(message => message.participant)
    .filter((value, index, array) => array.indexOf(value) === index);

  if (!participantJids.length) {
    return;
  }

  const participantNumbers = participantJids
    .map(jid => String(jid).replace(/@.*/, "").replace(/\D/g, ""))
    .filter(number => number.length >= 10 && number.length <= 13);

  const participantContacts = await Contact.findAll({
    where: {
      companyId,
      isGroup: false,
      [Op.or]: [
        { remoteJid: { [Op.in]: participantJids } },
        { lidJid: { [Op.in]: participantJids } },
        ...(participantNumbers.length > 0 ? [
          { number: { [Op.in]: participantNumbers } },
          { canonicalNumber: { [Op.in]: participantNumbers } }
        ] : [])
      ]
    },
    attributes: [
      "id",
      "name",
      "number",
      "profilePicUrl",
      "urlPicture",
      "updatedAt",
      "companyId",
      "remoteJid",
      "lidJid",
      "canonicalNumber"
    ],
    limit: 200
  });

  const participantMap = new Map();
  participantContacts.forEach(contact => {
    if (contact.remoteJid) participantMap.set(contact.remoteJid, contact);
    if (contact.lidJid) participantMap.set(contact.lidJid, contact);
    if (contact.number) participantMap.set(contact.number, contact);
    if (contact.canonicalNumber) participantMap.set(contact.canonicalNumber, contact);
  });

  messages.forEach((message: any) => {
    if (message.fromMe || !message.participant) {
      return;
    }

    let participantContact = participantMap.get(message.participant);

    if (!participantContact) {
      const participantNumber = String(message.participant).replace(/@.*/, "").replace(/\D/g, "");
      if (participantNumber.length >= 10) {
        participantContact = participantMap.get(participantNumber);
      }
    }

    if (!participantContact) {
      return;
    }

    message.contact = {
      id: participantContact.id,
      name: participantContact.name || message.senderName,
      isGroup: false,
      profilePicUrl: participantContact.profilePicUrl,
      urlPicture: participantContact.urlPicture,
      updatedAt: participantContact.updatedAt,
      companyId: participantContact.companyId,
      number: participantContact.number
    };
  });

  logger.debug(
    `[ListMessages] Enriquecidas ${messages.filter((message: any) => !message.fromMe && message.participant && message.contact?.isGroup === false).length} mensagens de grupo com avatar dos participantes`
  );
};

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

  logger.debug(`[ListMessages] ticketId=${ticket.id} uuid=${ticket.uuid} isGroup=${ticket.isGroup} status=${ticket.status} pageNumber=${pageNumber} companyId=${companyId}`);

  const ticketsFilter: any[] | null = [];

  // Para GRUPOS: buscar mensagens de TODOS os tickets do mesmo grupo
  // (pode haver tickets históricos/duplicados com mensagens vinculadas)
  if (ticket.isGroup) {
    const groupTicketIds = await Ticket.findAll({
      where: {
        contactId: ticket.contactId,
        companyId: ticket.companyId,
        isGroup: true
      },
      attributes: ["id"],
      limit: 100,
      order: [['createdAt', 'DESC']]
    });
    const ids = groupTicketIds.map(t => t.id);
    ticketsFilter.push(ids.length > 0 ? ids : [ticket.id]);
    logger.debug(`[ListMessages] GRUPO: contactId=${ticket.contactId} ticketIds=${JSON.stringify(ids)}`);
  } else {
    // Histórico unificado: buscar mensagens de TODOS os tickets do mesmo contato
    // CORREÇÃO: Buscar TODOS os tickets do contato (não apenas anteriores)
    const isAllHistoricEnabled = await isQueueIdHistoryBlocked({ userRequest: user.id });
    
    let ticketIds = [];
    if (!isAllHistoricEnabled && queues && queues.length > 0) {
      // Com filtro de fila (usuário restrito)
      ticketIds = await Ticket.findAll({
        where: {
          companyId: ticket.companyId,
          contactId: ticket.contactId,
          whatsappId: ticket.whatsappId,
          isGroup: ticket.isGroup,
          queueId: user.profile === "admin" || user.allTicket === "enable" || (ticket.isGroup && user.allowGroup) ?
            { [Op.or]: [queues, null] } :
            { [Op.in]: queues }
        },
        attributes: ["id"],
        limit: 100,
        order: [['createdAt', 'DESC']]
      });
    } else {
      // Sem filtro de fila (admin, allTicket, ou histórico liberado)
      // REGRA DE UNIFICAÇÃO:
      // 1. Mesmo contato + mesma conexão → unificar
      // 2. Conexões diferentes → manter histórico separado
      // 3. Tickets órfãos (whatsappId=null) só unificam entre si

      const whereClause: any = {
        companyId: ticket.companyId,
        contactId: ticket.contactId,
        isGroup: ticket.isGroup,
        whatsappId: ticket.whatsappId || null
      };

      ticketIds = await Ticket.findAll({
        where: whereClause,
        attributes: ["id", "whatsappId"],
        limit: 100,
        order: [['createdAt', 'DESC']]
      });
      
      logger.debug(`[ListMessages] UNIFICADO: contactId=${ticket.contactId} whatsappIdAtual=${ticket.whatsappId} ticketIds=${JSON.stringify(ticketIds.map(t => `${t.id}(${t.whatsappId})`))}`);
    }

    if (ticketIds && ticketIds.length > 0) {
      ticketsFilter.push(ticketIds.map(t => t.id));
      logger.debug(`[ListMessages] UNIFICADO: contactId=${ticket.contactId} ticketIds=${JSON.stringify(ticketIds.map(t => t.id))}`);
    } else {
      // Fallback: usar apenas o ticket atual se não encontrou outros
      ticketsFilter.push([ticket.id]);
    }
  }

  const tickets: number[] = intersection(...ticketsFilter);

  if (!tickets) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  // await setMessagesAsRead(ticket);
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  // NOTA: Cache desabilitado para histórico unificado (múltiplos tickets)
  // O cache é por ticketId individual e não funciona bem com unificação
  const hasMultipleTickets = tickets.length > 1;
  
  // Verificar cache apenas para página 1 e ticket único (sem unificação)
  if (+pageNumber === 1 && !hasMultipleTickets) {
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
    attributes: ["id", "fromMe", "mediaUrl", "body", "mediaType", "ack", "createdAt", "ticketId", "isDeleted", "queueId", "isForwarded", "isEdited", "isPrivate", "isStarred", "companyId", "dataJson", "audioTranscription", "participant", "senderName", "wid", "contactId", "quotedMsgId"],
    limit,
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: [
          "id",
          "name",
          "isGroup",
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
        attributes: ["id", "fromMe", "mediaUrl", "body", "mediaType", "companyId", "audioTranscription", "participant", "senderName"],
        as: "quotedMsg",
        include: [
          {
            model: Contact,
            as: "contact",
            attributes: [
              "id",
              "name",
              "isGroup",
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
        attributes: ["id", "whatsappId", "queueId", "createdAt", "userId", "status"],
        include: [
          {
            model: Queue,
            as: "queue",
            attributes: ["id", "name", "color"]
          },
          {
            model: User,
            as: "user",
            attributes: ["id", "name"]
          }
        ],
      }
    ],
    distinct: true,
    offset,
    subQuery: false,
    order: [["createdAt", "DESC"]]
  });

  logger.debug(`[ListMessages] ticketId=${ticket.id} isGroup=${ticket.isGroup} tickets=${JSON.stringify(tickets)} count=${count} messages=${messages.length} offset=${offset}`);

  // DEBUG: Listar ticketIds únicos nas mensagens
  const uniqueTicketIds = [...new Set(messages.map((m: any) => m.ticketId))];
  logger.debug(`[ListMessages] DEBUG: ticketIds únicos nas mensagens: ${JSON.stringify(uniqueTicketIds)}`);

  if (ticket.isGroup) {
    await enrichGroupParticipantContacts({
      messages: messages as any[],
      companyId
    });
  }

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
        logger.debug(`[ListMessages] Histórico local esgotou, buscando mais do WhatsApp para ticketId=${ticket.id}`);

        const syncResult = await ImportContactHistoryService({
          ticketId: ticket.id,
          companyId,
          periodMonths: 0
        });

        // Se sincronizou novas mensagens, refazer a query
        if (syncResult.synced > 0) {
          logger.debug(`[ListMessages] Sincronizadas ${syncResult.synced} mensagens, refazendo query`);

          const { count: newCount, rows: newMessages } = await Message.findAndCountAll({
            where: { ticketId: tickets, companyId },
            attributes: ["id", "fromMe", "mediaUrl", "body", "mediaType", "ack", "createdAt", "ticketId", "isDeleted", "queueId", "isForwarded", "isEdited", "isPrivate", "isStarred", "companyId", "dataJson", "audioTranscription", "participant", "senderName", "wid", "contactId", "quotedMsgId"],
            limit,
            include: [
              {
                model: Contact,
                as: "contact",
                attributes: ["id", "name", "isGroup", "profilePicUrl", "urlPicture", "updatedAt", "companyId"],
              },
              {
                model: Message,
                attributes: ["id", "fromMe", "mediaUrl", "body", "mediaType", "companyId", "audioTranscription", "participant", "senderName"],
                as: "quotedMsg",
                include: [
                  {
                    model: Contact,
                    as: "contact",
                    attributes: ["id", "name", "isGroup", "profilePicUrl", "urlPicture", "updatedAt", "companyId"],
                  }
                ],
                required: false
              },
              {
                model: Ticket,
                required: true,
                attributes: ["id", "whatsappId", "queueId", "createdAt", "status"],
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

          if (ticket.isGroup) {
            await enrichGroupParticipantContacts({
              messages: newMessages as any[],
              companyId
            });
          }

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
