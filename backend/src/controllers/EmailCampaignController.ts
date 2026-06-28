import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import ListService from "../services/EmailCampaignService/ListService";
import CreateService from "../services/EmailCampaignService/CreateService";
import ShowService from "../services/EmailCampaignService/ShowService";
import UpdateService from "../services/EmailCampaignService/UpdateService";
import DeleteService from "../services/EmailCampaignService/DeleteService";
import { CancelService } from "../services/EmailCampaignService/CancelService";
import GetReportService from "../services/EmailCampaignService/GetReportService";
import { startEmailCampaignNow } from "../queues/EmailCampaignQueue";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

type StoreData = {
  name: string;
  subject: string;
  message: string;
  contactListId?: number | string | null;
  scheduledAt?: string | null;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;
  const { companyId } = req.user;

  const { records, count, hasMore } = await ListService({
    searchParam,
    pageNumber,
    companyId
  });

  return res.json({ records, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const data = req.body as StoreData;

  const record = await CreateService({ ...data, companyId, userId });

  const io = getIO();
  io.of(`/workspace-${companyId}`).emit(`company-${companyId}-email-campaign`, {
    action: "create",
    record
  });

  return res.status(200).json(record);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;

  const record = await ShowService(id);

  return res.status(200).json(record);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const data = req.body as StoreData;

  const record = await UpdateService({ ...data, id });

  const io = getIO();
  io.of(`/workspace-${companyId}`).emit(`company-${companyId}-email-campaign`, {
    action: "update",
    record
  });

  return res.status(200).json(record);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  await DeleteService(id);

  const io = getIO();
  io.of(`/workspace-${companyId}`).emit(`company-${companyId}-email-campaign`, {
    action: "delete",
    id
  });

  return res.status(200).json({ message: "Email campaign deleted" });
};

export const cancel = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;

  await CancelService(id);

  return res.status(204).json({ message: "Cancelamento realizado" });
};

export const sendNow = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;

  await startEmailCampaignNow(+id);

  return res.status(200).json({ message: "Campanha de e-mail iniciada" });
};

export const report = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;

  const data = await GetReportService(id);

  return res.status(200).json(data);
};
