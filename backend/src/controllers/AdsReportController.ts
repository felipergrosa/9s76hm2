import { Request, Response } from "express";
import AdsReportService from "../services/TicketServices/AdsReportService";

interface IndexQuery {
  startDate?: string;
  endDate?: string;
}

/**
 * Agregados do funil CTWA por anúncio + totais do período
 * GET /ads-report?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const query = req.query as IndexQuery;

  const { ads, totals } = await AdsReportService({
    companyId: Number(companyId),
    startDate: query.startDate || undefined,
    endDate: query.endDate || undefined
  });

  return res.json({ ads, totals });
};
