import { Request, Response } from "express";
import AppError from "../../errors/AppError";
import GetMessageRangeService from "../../services/MessageServices/GetMessageRangeService";

export const show = async (req: Request, res: Response): Promise<Response> => {
  // COMPANY_TOKEN is a global integration secret and cannot identify a tenant.
  // This endpoint requires a user JWT so the tenant comes from verified claims.
  const companyId = Number((req as any).user?.companyId);
  if (!Number.isSafeInteger(companyId) || companyId <= 0) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const requestedCompanyId = req.query.companyId;
  if (requestedCompanyId !== undefined && String(requestedCompanyId) !== String(companyId)) {
    throw new AppError("FORBIDDEN_COMPANY", 403);
  }
  const { startDate, lastDate, cursor } = req.query;
  const rawLimit = req.query.limit === undefined ? 100 : Number(req.query.limit);
  const result = await GetMessageRangeService({
    companyId,
    startDate: startDate as string,
    lastDate: lastDate as string,
    limit: rawLimit,
    cursor: cursor as string | undefined
  });
  return res.status(200).json(result);
};
