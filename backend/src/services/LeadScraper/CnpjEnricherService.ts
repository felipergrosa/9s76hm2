import { ScraperResult } from "../../models/LeadScraperJob";
import logger from "../../utils/logger";
import { enrichCnpjCascade } from "./CnpjSearchService";

export const enrichCnpj = async (cnpj: string): Promise<ScraperResult | null> => {
  try {
    const lead = await enrichCnpjCascade(cnpj);
    if (lead) delete (lead as any)._cnaesSec;
    return lead;
  } catch (err: any) {
    logger.warn(`[CnpjEnricher] falha ao enriquecer ${cnpj}: ${err.message}`);
    return null;
  }
};
