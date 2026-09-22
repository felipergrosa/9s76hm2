import { Request, Response } from "express";
import ImportLeadsService from "../services/ContactServices/ImportLeadsService";
import { enqueueLeadExport } from "../services/LeadScraper/LeadExportService";
import logger from "../utils/logger";

export const importLeads = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { leads, contactListName, tagName, validateNumber } = req.body;
  const file = req.file as Express.Multer.File | undefined;

  const parsedLeads = typeof leads === "string" ? JSON.parse(leads) : leads;

  const result = await ImportLeadsService({
    companyId,
    leads: parsedLeads,
    file,
    contactListName,
    tagName,
    validateNumber: validateNumber === true || validateNumber === "true"
  });

  // Envia lote p/ ERP via n8n em background (importações manuais também sincronizam)
  try {
    await enqueueLeadExport({
      companyId,
      contactIds: result.contactIds || [],
      source: "leads_import"
    });
  } catch (err: any) {
    logger.warn(`[LeadController] Falha ao enfileirar export ERP: ${err?.message}`);
  }

  return res.status(200).json(result);
};
