import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { Op } from "sequelize";
import Ticket from "../models/Ticket";
import AppError from "../errors/AppError";
import User from "../models/User";

import CreateTicketService from "../services/TicketServices/CreateTicketService";
import DeleteTicketService from "../services/TicketServices/DeleteTicketService";
import ListTicketsService from "../services/TicketServices/ListTicketsService";
import ShowTicketUUIDService from "../services/TicketServices/ShowTicketFromUUIDService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import ListTicketsServiceKanban from "../services/TicketServices/ListTicketsServiceKanban";

import CreateLogTicketService from "../services/TicketServices/CreateLogTicketService";
import ShowLogTicketService from "../services/TicketServices/ShowLogTicketService";
import FindOrCreateATicketTrakingService from "../services/TicketServices/FindOrCreateATicketTrakingService";
import ListTicketsServiceReport from "../services/TicketServices/ListTicketsServiceReport";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import { Mutex } from "async-mutex";
import Queue from "../models/Queue";
import Chatbot from "../models/Chatbot";
import Prompt from "../models/Prompt";
import AIAgent from "../models/AIAgent";
import GetUserWalletContactIds from "../helpers/GetUserWalletContactIds";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  status: string;
  date?: string;
  dateStart?: string;
  dateEnd?: string;
  updatedAt?: string;
  showAll: string;
  withUnreadMessages?: string;
  queueIds?: string;
  tags?: string;
  users?: string;
  whatsapps: string;
  statusFilter: string;
  isGroup?: string;
  sortTickets?: string;
  searchOnMessages?: string;
  viewingUserId?: string;
};

type IndexQueryReport = {
  searchParam: string;
  contactId: string;
  whatsappId: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  queueIds: string;
  tags: string;
  users: string;
  page: string;
  pageSize: string;
  onlyRated: string;
};

const safeParseArray = (value: any): any[] => {
  if (!value) {
    return [];
  }

  try {
    if (Array.isArray(value)) {
      return value;
    }

    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (parsed === null || parsed === undefined) {
      return [];
    }

    return [parsed];
  } catch (err) {
    return [];
  }
};

interface TicketData {
  contactId: number;
  status: string;
  queueId: number;
  userId: number;
  sendFarewellMessage?: boolean;
  whatsappId?: string;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const {
    pageNumber,
    status,
    date,
    dateStart,
    dateEnd,
    updatedAt,
    searchParam,
    showAll,
    queueIds: queueIdsStringified,
    tags: tagIdsStringified,
    users: userIdsStringified,
    withUnreadMessages,
    whatsapps: whatsappIdsStringified,
    statusFilter: statusStringfied,
    sortTickets,
    searchOnMessages
  } = req.query as IndexQuery;

  const userId = Number(req.user.id);
  const { companyId } = req.user;

  let queueIds: number[] = [];
  let tagsIds: number[] = [];
  let usersIds: number[] = [];
  let whatsappIds: number[] = [];
  let statusFilters: string[] = [];

  queueIds = safeParseArray(queueIdsStringified) as number[];
  tagsIds = safeParseArray(tagIdsStringified) as number[];
  usersIds = safeParseArray(userIdsStringified) as number[];
  whatsappIds = safeParseArray(whatsappIdsStringified) as number[];
  statusFilters = safeParseArray(statusStringfied) as string[];

  const { tickets, count, hasMore } = await ListTicketsService({
    searchParam,
    tags: tagsIds,
    users: usersIds,
    pageNumber,
    status,
    date,
    dateStart,
    dateEnd,
    updatedAt,
    showAll,
    userId,
    queueIds,
    withUnreadMessages,
    whatsappIds,
    statusFilters,
    companyId,
    sortTickets,
    searchOnMessages
  });

  return res.status(200).json({ tickets, count, hasMore });
};

export const report = async (req: Request, res: Response): Promise<Response> => {
  const {
    searchParam,
    contactId,
    whatsappId: whatsappIdsStringified,
    dateFrom,
    dateTo,
    status: statusStringified,
    queueIds: queueIdsStringified,
    tags: tagIdsStringified,
    users: userIdsStringified,
    page: pageNumber,
    pageSize,
    onlyRated
  } = req.query as IndexQueryReport;


  const userId = String(req.user.id);
  const { companyId } = req.user;

  const walletResult = await GetUserWalletContactIds(Number(userId), Number(companyId));
  const walletContactIds = walletResult.hasWalletRestriction ? walletResult.contactIds : null;
  const walletUserIds = walletResult.hasWalletRestriction
    ? [Number(userId), ...walletResult.managedUserIds]
    : null;

  let queueIds: number[] = [];
  let whatsappIds: string[] = [];
  let tagsIds: number[] = [];
  let usersIds: number[] = [];
  let statusIds: string[] = [];

  statusIds = safeParseArray(statusStringified) as string[];
  whatsappIds = safeParseArray(whatsappIdsStringified) as string[];
  queueIds = safeParseArray(queueIdsStringified) as number[];
  tagsIds = safeParseArray(tagIdsStringified) as number[];
  usersIds = safeParseArray(userIdsStringified) as number[];

  const { tickets, totalTickets } = await ListTicketsServiceReport(
    companyId,
    {
      searchParam,
      queueIds,
      tags: tagsIds,
      users: usersIds,
      status: statusIds,
      dateFrom,
      dateTo,
      userId,
      contactId,
      whatsappId: whatsappIds,
      onlyRated: onlyRated,
      walletContactIds,
      walletUserIds
    },
    +pageNumber,

    +pageSize
  );

  return res.status(200).json({ tickets, totalTickets });
};

export const kanban = async (req: Request, res: Response): Promise<Response> => {
  const {
    pageNumber,
    status,
    date,
    dateStart,
    dateEnd,
    updatedAt,
    searchParam,
    showAll,
    queueIds: queueIdsStringified,
    tags: tagIdsStringified,
    users: userIdsStringified,
    withUnreadMessages
  } = req.query as IndexQuery;



  const { companyId, profile, id } = req.user;
  const user = req.user as any;
  const managedUserIds = user.managedUserIds;
  const requestUserId = Number(id);

  let targetUserId = requestUserId;

  let queueIds: number[] = [];
  let tagsIds: number[] = [];
  let usersIds: number[] = [];

  if (queueIdsStringified) {
    queueIds = safeParseArray(queueIdsStringified) as number[];
  }
  if (tagIdsStringified) {
    tagsIds = safeParseArray(tagIdsStringified) as number[];
  }
  if (userIdsStringified) {
    usersIds = safeParseArray(userIdsStringified) as number[];
  }

  // Lógica de permissão para visualizar kanban de outro usuário
  const { viewingUserId } = req.query as IndexQuery;
  if (viewingUserId) {
    const vUserId = Number(viewingUserId);
    if (profile === "admin") {
      targetUserId = vUserId;
    } else {
      const allowed = managedUserIds ? managedUserIds.map((uid: any) => Number(uid)) : [];
      if (allowed.includes(vUserId)) {
        targetUserId = vUserId;
      } else if (vUserId === requestUserId) {
        targetUserId = vUserId;
      } else {
        throw new AppError("ERR_NO_PERMISSION", 403);
      }
    }
  }

  const { tickets, count, hasMore } = await ListTicketsServiceKanban({
    searchParam,
    tags: tagsIds,
    users: usersIds,
    pageNumber,
    status,
    date,
    dateStart,
    dateEnd,
    updatedAt,
    showAll,
    userId: String(targetUserId),
    queueIds,
    withUnreadMessages,
    companyId
  });

  return res.status(200).json({ tickets, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { contactId, status, userId, queueId, whatsappId }: TicketData = req.body;
  const { companyId } = req.user;

  const ticket = await CreateTicketService({
    contactId,
    status,
    userId,
    companyId,
    queueId,
    whatsappId
  });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    // .to(ticket.status)
    .emit(`company-${companyId}-ticket`, {
      action: "update",
      ticket
    });

  return res.status(200).json(ticket);
};

export const transferToBot = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;
  const { queueId } = req.body as { queueId?: number | string };

  const parsedQueueId = Number(queueId);
  if (!Number.isInteger(parsedQueueId) || parsedQueueId <= 0) {
    throw new AppError("ERR_QUEUE_ID_REQUIRED", 400);
  }

  const queue = await Queue.findOne({
    where: { id: parsedQueueId, companyId },
    include: [
      {
        model: Chatbot,
        as: "chatbots",
        attributes: ["id"],
        required: false
      },
      {
        model: Prompt,
        as: "prompt",
        attributes: ["id"],
        required: false
      }
    ]
  });

  if (!queue) {
    throw new AppError("ERR_QUEUE_NOT_FOUND", 404);
  }

  const hasChatbots = Array.isArray((queue as any).chatbots) && (queue as any).chatbots.length > 0;
  const hasPrompt = Array.isArray((queue as any).prompt) && (queue as any).prompt.length > 0;
  const hasRag = Boolean((queue as any).ragCollection && String((queue as any).ragCollection).trim());

  let hasAgent = false;
  if (!hasChatbots && !hasPrompt && !hasRag) {
    const agents = await AIAgent.findAll({
      where: {
        companyId,
        status: "active"
      },
      attributes: ["queueIds"]
    });
    hasAgent = agents.some(agent => Array.isArray((agent as any).queueIds) && (agent as any).queueIds.includes(parsedQueueId));
  }

  if (!hasChatbots && !hasPrompt && !hasRag && !hasAgent) {
    throw new AppError("ERR_QUEUE_HAS_NO_BOT", 400);
  }

  const mutex = new Mutex();
  const { ticket } = await mutex.runExclusive(async () => {
    const result = await UpdateTicketService({
      ticketData: {
        queueId: parsedQueueId,
        status: "bot",
        isBot: true,
        userId: null,
        isTransfered: false
      } as any,
      ticketId,
      companyId
    });
    return result;
  });

  return res.status(200).json(ticket);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { id: userId, companyId, profile } = req.user as any;

  const ticket = await ShowTicketService(ticketId, companyId);

  // Verificação de acesso por carteira (inclui supervisor via managedUserIds)
  const walletResult = await GetUserWalletContactIds(Number(userId), Number(companyId));

  // Modo EXCLUDE: bloqueia acesso a tickets dos usuários excluídos
  if (walletResult.excludedUserIds && walletResult.excludedUserIds.length > 0) {
    const isExcludedUser = walletResult.excludedUserIds.includes(Number(ticket.userId));
    const isOwnTicket = Number(ticket.userId) === Number(userId);
    const isUnassigned = !ticket.userId;

    if (isExcludedUser && !isOwnTicket && !isUnassigned) {
      throw new AppError("FORBIDDEN_CONTACT_ACCESS", 403);
    }
  } else if (walletResult.hasWalletRestriction) {
    const allowedUserIds = [Number(userId), ...walletResult.managedUserIds];
    const allowedContactIds = walletResult.contactIds;

    const allowedByTicketOwner = allowedUserIds.includes(Number(ticket.userId));
    const allowedByWalletContact = allowedContactIds.includes(Number(ticket.contactId));

    if (!allowedByTicketOwner && !allowedByWalletContact) {
      throw new AppError("FORBIDDEN_CONTACT_ACCESS", 403);
    }
  }

  await CreateLogTicketService({
    userId,
    ticketId,
    type: "access"
  });

  return res.status(200).json(ticket);
};

export const showLog = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { id: userId, companyId } = req.user;

  const log = await ShowLogTicketService({ ticketId, companyId });

  return res.status(200).json(log);
};

export const showFromUUID = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { uuid } = req.params;
  const { id: userId, companyId, profile } = req.user as any;


  const ticket: Ticket = await ShowTicketUUIDService(uuid, companyId);

  if (ticket.channel === "whatsapp" && ticket.whatsappId && ticket.unreadMessages > 0) {
    await SetTicketMessagesAsRead(ticket);
  }
  await CreateLogTicketService({
    userId,
    ticketId: ticket.id,
    type: "access"
  });

  // Verificação de acesso por carteira (inclui supervisor via managedUserIds)
  const walletResult = await GetUserWalletContactIds(Number(userId), Number(companyId));

  // Modo EXCLUDE: bloqueia acesso a tickets dos usuários excluídos
  if (walletResult.excludedUserIds && walletResult.excludedUserIds.length > 0) {
    const isExcludedUser = walletResult.excludedUserIds.includes(Number(ticket.userId));
    const isOwnTicket = Number(ticket.userId) === Number(userId);
    const isUnassigned = !ticket.userId;

    if (isExcludedUser && !isOwnTicket && !isUnassigned) {
      throw new AppError("FORBIDDEN_CONTACT_ACCESS", 403);
    }
  } else if (walletResult.hasWalletRestriction) {
    const allowedUserIds = [Number(userId), ...walletResult.managedUserIds];
    const allowedContactIds = walletResult.contactIds;

    const allowedByTicketOwner = allowedUserIds.includes(Number(ticket.userId));
    const allowedByWalletContact = allowedContactIds.includes(Number(ticket.contactId));

    if (!allowedByTicketOwner && !allowedByWalletContact) {
      throw new AppError("FORBIDDEN_CONTACT_ACCESS", 403);
    }
  }

  return res.status(200).json(ticket);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const ticketData: TicketData = req.body;
  const { companyId } = req.user;

  const mutex = new Mutex();
  const { ticket } = await mutex.runExclusive(async () => {
    const result = await UpdateTicketService({
      ticketData,
      ticketId,
      companyId
    });
    return result;
  });

  return res.status(200).json(ticket);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { id: userId, companyId } = req.user;

  // await ShowTicketService(ticketId, companyId);

  const ticket = await DeleteTicketService(ticketId, userId, companyId);

  const io = getIO();

  io.of(`/workspace-${companyId}`)
    // .to(ticket.status)
    // .to(ticketId)
    // .to("notification")
    .emit(`company-${companyId}-ticket`, {
      action: "delete",
      ticketId: +ticketId
    });

  return res.status(200).json({ message: "ticket deleted" });
};

export const bulkProcess = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const {
    ticketIds,
    responseType,
    responseMessage,
    aiAgentId,
    kanbanLaneId,
    tagIds,
    newStatus,
    closeTicket,
    addNote,
    queueId
  } = req.body;

  try {
    // Validações
    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return res.status(400).json({ error: "ticketIds é obrigatório e deve ser um array" });
    }

    if (!responseType || !['none', 'standard', 'ai'].includes(responseType)) {
      return res.status(400).json({ error: "responseType inválido" });
    }

    if (responseType === 'standard' && !responseMessage) {
      return res.status(400).json({ error: "responseMessage é obrigatório quando responseType é 'standard'" });
    }

    if (responseType === 'ai' && !aiAgentId) {
      return res.status(400).json({ error: "aiAgentId é obrigatório quando responseType é 'ai'" });
    }

    // Importar service dinamicamente para evitar circular dependency
    const BulkProcessTicketsService = (await import("../services/TicketServices/BulkProcessTicketsService")).default;

    const result = await BulkProcessTicketsService({
      ticketIds,
      companyId,
      userId: Number(userId),
      responseType,
      responseMessage,
      aiAgentId,
      kanbanLaneId,
      tagIds,
      newStatus,
      closeTicket,
      addNote,
      queueId
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[BulkProcess] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao processar tickets em massa" });
  }
};

export const closeAll = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { status }: TicketData = req.body;
  const io = getIO();

  const { rows: tickets } = await Ticket.findAndCountAll({
    where: { companyId: companyId, status: status },
    order: [["updatedAt", "DESC"]]
  });

  tickets.forEach(async ticket => {

    const ticketData = {
      status: "closed",
      userId: ticket.userId || null,
      queueId: ticket.queueId || null,
      unreadMessages: 0,
      amountUsedBotQueues: 0,
      sendFarewellMessage: false
    };

    await UpdateTicketService({ ticketData, ticketId: ticket.id, companyId })

  });

  return res.status(200).json();
};