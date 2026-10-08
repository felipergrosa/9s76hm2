import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import ListService from "../services/MetaAutomationService/ListService";
import CreateService from "../services/MetaAutomationService/CreateService";
import ShowService from "../services/MetaAutomationService/ShowService";
import UpdateService from "../services/MetaAutomationService/UpdateService";
import DeleteService from "../services/MetaAutomationService/DeleteService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  whatsappId: string;
  channel: string;
  trigger: string;
  active: string;
};

type StoreData = {
  name: string;
  whatsappId: number;
  channel: string;
  trigger: string;
  matchValue?: string | null;
  dmText?: string | null;
  publicReplyText?: string | null;
  flowId?: number | null;
  autoLikeComment?: boolean;
  requireFollower?: boolean;
  nonFollowerAction?: string | null;
  nonFollowerText?: string | null;
  rewardMediaUrl?: string | null;
  rewardMediaType?: string | null;
  active?: boolean;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber, whatsappId, channel, trigger, active } =
    req.query as IndexQuery;
  const { companyId } = req.user;

  const { records, count, hasMore } = await ListService({
    searchParam,
    pageNumber,
    whatsappId,
    channel,
    trigger,
    active,
    companyId
  });

  return res.json({ records, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = req.body as StoreData;

  const record = await CreateService({ ...data, companyId });

  const io = getIO();
  io.of(`/workspace-${companyId}`).emit(`company-${companyId}-meta-automation`, {
    action: "create",
    record
  });

  return res.status(200).json(record);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  const record = await ShowService(id, companyId);

  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const data = req.body as StoreData;

  const record = await UpdateService({ ...data, id, companyId });

  const io = getIO();
  io.of(`/workspace-${companyId}`).emit(`company-${companyId}-meta-automation`, {
    action: "update",
    record
  });

  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  await DeleteService(id, companyId);

  const io = getIO();
  io.of(`/workspace-${companyId}`).emit(`company-${companyId}-meta-automation`, {
    action: "delete",
    id
  });

  return res.status(200).json({ message: "Meta automation rule deleted" });
};
