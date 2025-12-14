import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import CreateQueueService from "../services/QueueService/CreateQueueService";
import DeleteQueueService from "../services/QueueService/DeleteQueueService";
import ListQueuesService from "../services/QueueService/ListQueuesService";
import ShowQueueService from "../services/QueueService/ShowQueueService";
import UpdateQueueService from "../services/QueueService/UpdateQueueService";
import { isNil } from "lodash";

type QueueFilter = {
  companyId: number;
  onlyWithBot?: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId: userCompanyId } = req.user;
  const { companyId: queryCompanyId, onlyWithBot } = req.query as unknown as QueueFilter;
  let companyId = userCompanyId;

  if (!isNil(queryCompanyId)) {
    companyId = +queryCompanyId;
  }

  const queues = await ListQueuesService({
    companyId,
    onlyWithBot: String(onlyWithBot || "").toLowerCase() === "true"
  });

  return res.status(200).json(queues);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    name,
    color,
    greetingMessage,
    outOfHoursMessage,
    schedules,
    chatbots,
    orderQueue,
    tempoRoteador,
    ativarRoteador,
    integrationId,
    fileListId,
    folderId,  // ID da pasta do File Manager
    closeTicket,
    autoSendStrategy,
    confirmationTemplate,
    maxFilesPerSession,
    ragCollection
  } = req.body;
  const { companyId } = req.user;

  const queue = await CreateQueueService({
    name,
    color,
    greetingMessage,
    companyId,
    outOfHoursMessage,
    tempoRoteador: tempoRoteador === "" ? 0 : tempoRoteador,
    ativarRoteador,
    schedules,
    chatbots,
    orderQueue: orderQueue === "" ? null : orderQueue,
    integrationId: integrationId === "" ? null : integrationId,
    fileListId: fileListId === "" ? null : fileListId,
    folderId: folderId === "" ? null : folderId,  // Converter string vazia em null
    closeTicket,
    autoSendStrategy: autoSendStrategy || "none",
    confirmationTemplate: confirmationTemplate || null,
    maxFilesPerSession: maxFilesPerSession || 3,
    ragCollection: ragCollection || null
  });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company-${companyId}-queue`, {
      action: "update",
      queue
    });

  return res.status(200).json(queue);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { queueId } = req.params;
  const { companyId } = req.user;

  const queue = await ShowQueueService(queueId, companyId);

  return res.status(200).json(queue);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { queueId } = req.params;
  const { companyId } = req.user;

  const {
    name,
    color,
    greetingMessage,
    outOfHoursMessage,
    schedules,
    chatbots,
    orderQueue,
    tempoRoteador,
    ativarRoteador,
    integrationId,
    fileListId,
    folderId,  // ID da pasta do File Manager
    closeTicket,
    autoSendStrategy,
    confirmationTemplate,
    maxFilesPerSession,
    ragCollection
  } = req.body;

  const queue = await UpdateQueueService(queueId,
    {
      name,
      color,
      greetingMessage,
      outOfHoursMessage,
      tempoRoteador: tempoRoteador === "" ? 0 : tempoRoteador,
      ativarRoteador,
      schedules,
      chatbots,
      orderQueue: orderQueue === "" ? null : orderQueue,
      integrationId: integrationId === "" ? null : integrationId,
      fileListId: fileListId === "" ? null : fileListId,
      folderId: folderId === "" ? null : folderId,  // Converter string vazia em null
      closeTicket,
      autoSendStrategy: autoSendStrategy || "none",
      confirmationTemplate: confirmationTemplate || null,
      maxFilesPerSession: maxFilesPerSession || 3,
      ragCollection: ragCollection || null
    },
    companyId);

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company-${companyId}-queue`, {
      action: "update",
      queue
    });

  return res.status(201).json(queue);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { queueId } = req.params;
  const { companyId } = req.user;

  await DeleteQueueService(queueId, companyId);

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company-${companyId}-queue`, {
      action: "delete",
      queueId: +queueId
    });

  return res.status(200).send();
};
