import { Request, Response } from "express";
import CompaniesSettings from "../models/CompaniesSettings";
import IngestExternalFormContactService from "../services/ContactServices/IngestExternalFormContactService";
import AppError from "../errors/AppError";
import logger from "../utils/logger";

/**
 * Webhook genérico de ingestão de formulário externo (ex: bloco "Webhook"
 * de um fluxo Typebot). Autenticado por token compartilhado por empresa
 * (CompaniesSettings.externalFormWebhookToken), seguindo o mesmo padrão de
 * shared-secret já usado nos webhooks da Meta (item 1 do plano).
 */
export const receive = async (req: Request, res: Response): Promise<Response> => {
  const { token } = req.params;

  if (!token) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const settings = await CompaniesSettings.findOne({
    where: { externalFormWebhookToken: token }
  });

  if (!settings) {
    logger.warn(`[ExternalFormWebhook] Token inválido recebido`);
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const contact = await IngestExternalFormContactService({
      companyId: settings.companyId,
      payload: req.body || {}
    });

    return res.status(200).json({ contactId: contact.id });
  } catch (err: any) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    logger.error(`[ExternalFormWebhook] Erro ao processar payload: ${err.message}`);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
