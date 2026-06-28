import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import ListService from "../services/DripSequenceService/ListService";
import CreateService from "../services/DripSequenceService/CreateService";
import ShowService from "../services/DripSequenceService/ShowService";
import UpdateService from "../services/DripSequenceService/UpdateService";
import DeleteService from "../services/DripSequenceService/DeleteService";
import ListEnrollmentsService from "../services/DripSequenceService/ListEnrollmentsService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

type StoreData = {
  name: string;
  tagId: number;
  whatsappId?: number | null;
  active?: boolean;
  steps: { order: number; delayDays: number; message: string }[];
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
  const { companyId } = req.user;
  const data = req.body as StoreData;

  const record = await CreateService({ ...data, companyId });

  const io = getIO();
  io.of(`/workspace-${companyId}`).emit(`company-${companyId}-drip-sequence`, {
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
  io.of(`/workspace-${companyId}`).emit(`company-${companyId}-drip-sequence`, {
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
  io.of(`/workspace-${companyId}`).emit(`company-${companyId}-drip-sequence`, {
    action: "delete",
    id
  });

  return res.status(200).json({ message: "Drip sequence deleted" });
};

export const enrollments = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;

  const records = await ListEnrollmentsService(id);

  return res.status(200).json(records);
};
