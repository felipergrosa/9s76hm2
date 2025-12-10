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


  const userId = req.user.id;
  const { companyId } = req.user;

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
      onlyRated: onlyRated
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


  // A linha abaixo ainda é necessária para obter o companyId
  const { companyId } = req.user;
  const userId = Number(req.user.id);

  let queueIds: number[] = [];
  let tagsIds: number[] = [];
  let usersIds: number[] = [];

  queueIds = safeParseArray(queueIdsStringified) as number[];
  tagsIds = safeParseArray(tagIdsStringified) as number[];
  usersIds = safeParseArray(userIdsStringified) as number[];

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
    userId: String(userId), 
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

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { id: userId, companyId, profile } = req.user as any;

  const ticket = await ShowTicketService(ticketId, companyId);

  // Verificação de acesso hierárquica: admin sempre pode; usuário pode se for dono do ticket
  // ou se o contato tiver PELO MENOS UMA tag pessoal (#) E PELO MENOS UMA tag complementar (## ou ###) do usuário
  // Contato sem tags: não libera acesso extra (somente o dono).
  if (profile !== "admin") {
    const me = await User.findByPk(Number(userId));
    const allowedTagIds: number[] = (me && Array.isArray((me as any).allowedContactTags)) ? (me as any).allowedContactTags : [];
    const isOwner = Number(ticket.userId) === Number(userId);
    
    if (!isOwner) {
      // Busca e categoriza tags do usuário
      const Tag = require("../models/Tag").default;
      const { categorizeTagsByName } = require("../helpers/TagCategoryHelper");
      
      const userPermissionTags = await Tag.findAll({
        where: {
          id: { [Op.in]: allowedTagIds },
          name: { [Op.like]: "#%" }
        },
        attributes: ["id", "name"]
      });
      
      const categorized = categorizeTagsByName(userPermissionTags);
      const userPersonalTags = categorized.personal;
      const userComplementaryTags = categorized.complementary;
      
      // Tags do contato
      const contactTags: any[] = Array.isArray((ticket as any)?.contact?.tags)
        ? (ticket as any).contact.tags
        : [];
      const contactTagIds = contactTags.map((t: any) => t.id);
      
      // Verifica se contato tem pelo menos uma tag pessoal do usuário
      const hasPersonalTag = contactTagIds.some(id => userPersonalTags.includes(id));
      
      // Verifica se contato tem pelo menos uma tag complementar do usuário (se usuário tiver)
      const hasComplementaryTag = userComplementaryTags.length === 0 || 
        contactTagIds.some(id => userComplementaryTags.includes(id));
      
      if (!hasPersonalTag || !hasComplementaryTag) {
        throw new AppError("FORBIDDEN_CONTACT_ACCESS", 403);
      }
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
    SetTicketMessagesAsRead(ticket);
  }
  await CreateLogTicketService({
    userId,
    ticketId: ticket.id,
    type: "access"
  });

  // Verificação de acesso hierárquica por tags/dono do ticket (mesma regra do show)
  if (profile !== "admin") {
    const me = await User.findByPk(Number(userId));
    const allowedTagIds: number[] = (me && Array.isArray((me as any).allowedContactTags)) ? (me as any).allowedContactTags : [];
    const isOwner = Number(ticket.userId) === Number(userId);
    
    if (!isOwner) {
      // Busca e categoriza tags do usuário
      const Tag = require("../models/Tag").default;
      const { categorizeTagsByName } = require("../helpers/TagCategoryHelper");
      
      const userPermissionTags = await Tag.findAll({
        where: {
          id: { [Op.in]: allowedTagIds },
          name: { [Op.like]: "#%" }
        },
        attributes: ["id", "name"]
      });
      
      const categorized = categorizeTagsByName(userPermissionTags);
      const userPersonalTags = categorized.personal;
      const userComplementaryTags = categorized.complementary;
      
      // Tags do contato
      const contactTags: any[] = Array.isArray((ticket as any)?.contact?.tags)
        ? (ticket as any).contact.tags
        : [];
      const contactTagIds = contactTags.map((t: any) => t.id);
      
      // Verifica se contato tem pelo menos uma tag pessoal do usuário
      const hasPersonalTag = contactTagIds.some(id => userPersonalTags.includes(id));
      
      // Verifica se contato tem pelo menos uma tag complementar do usuário (se usuário tiver)
      const hasComplementaryTag = userComplementaryTags.length === 0 || 
        contactTagIds.some(id => userComplementaryTags.includes(id));
      
      if (!hasPersonalTag || !hasComplementaryTag) {
        throw new AppError("FORBIDDEN_CONTACT_ACCESS", 403);
      }
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