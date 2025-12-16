import { Request, Response } from "express";
import AppError from "../errors/AppError";
import ListContactReleaseRequestsService from "../services/ContactServices/ListContactReleaseRequestsService";
import ResolveContactReleaseRequestService from "../services/ContactServices/ResolveContactReleaseRequestService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user as any;

  const records = await ListContactReleaseRequestsService({ companyId });

  return res.json({ records });
};

export const resolve = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: resolverId } = req.user as any;
  const { id } = req.params;

  const numericId = Number(id);
  if (!Number.isInteger(numericId)) {
    throw new AppError("ID inválido", 400);
  }

  const record = await ResolveContactReleaseRequestService({
    id: numericId,
    companyId,
    resolverId: Number(resolverId)
  });

  return res.json(record);
};
