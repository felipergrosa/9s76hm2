import { Request, Response } from "express";
import ListWhatsappHealthService from "../services/MetaServices/WhatsappHealthService";

/**
 * GET /whatsapp-health
 * Lista a saúde de cada conexão WhatsApp API Oficial (WABA) da empresa:
 * quality rating, messaging limit tier, status do nome de exibição e
 * status da conexão — consultados on-demand na Graph API.
 *
 * Falhas da Meta por número são isoladas no campo `error` de cada linha;
 * a rota só falha em erro de infraestrutura local (banco etc.).
 */
export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id } = req.user;

  const result = await ListWhatsappHealthService({
    companyId,
    userId: Number(id)
  });

  return res.status(200).json(result);
};
