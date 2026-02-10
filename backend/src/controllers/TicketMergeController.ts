import { Request, Response } from "express";
import MergeDuplicateTicketsService from "../services/TicketServices/MergeDuplicateTicketsService";
import logger from "../utils/logger";

/**
 * Endpoint para mesclar tickets duplicados de importação
 * POST /tickets/merge-duplicates
 * Body: { companyId: number, whatsappId?: number, dryRun?: boolean }
 */
export const mergeDuplicateTickets = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, whatsappId, dryRun = false } = req.body;

  try {
    logger.info(`[mergeDuplicateTickets] Solicitação recebida: companyId=${companyId}, dryRun=${dryRun}`);

    const result = await MergeDuplicateTicketsService({
      companyId: Number(companyId),
      whatsappId: whatsappId ? Number(whatsappId) : undefined,
      dryRun: Boolean(dryRun)
    });

    return res.status(200).json(result);
  } catch (error: any) {
    logger.error(`[mergeDuplicateTickets] Erro: ${error.message}`, error);
    return res.status(500).json({
      success: false,
      message: `Erro ao mesclar tickets: ${error.message}`,
      results: [],
      totalMerged: 0,
      totalMessagesMoved: 0
    });
  }
};

/**
 * Endpoint GET para verificar tickets duplicados (dry run automático)
 * GET /tickets/duplicate-check?companyId=X&whatsappId=Y
 */
export const checkDuplicateTickets = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, whatsappId } = req.query;

  if (!companyId) {
    return res.status(400).json({
      success: false,
      message: "companyId é obrigatório"
    });
  }

  try {
    const result = await MergeDuplicateTicketsService({
      companyId: Number(companyId),
      whatsappId: whatsappId ? Number(whatsappId) : undefined,
      dryRun: true // Sempre dry run no GET
    });

    return res.status(200).json(result);
  } catch (error: any) {
    logger.error(`[checkDuplicateTickets] Erro: ${error.message}`, error);
    return res.status(500).json({
      success: false,
      message: `Erro ao verificar tickets: ${error.message}`
    });
  }
};
