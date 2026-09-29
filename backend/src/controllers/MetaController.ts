import { Request, Response } from "express";
import GetApprovedTemplates from "../services/MetaServices/GetApprovedTemplates";
import GetSessionWindow from "../services/MetaServices/GetSessionWindow";
import SendTemplateToContact from "../services/MetaServices/SendTemplateToContact";
import AppError from "../errors/AppError";

export const getTemplates = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { all } = req.query as any;
  const { companyId } = (req as any).user;

  try {
    const templates = await GetApprovedTemplates({
      whatsappId: Number(whatsappId),
      companyId,
      includeAll: all === "true" || all === true
    });

    return res.status(200).json({ templates });
  } catch (err: any) {
    throw new AppError(err.message || "Erro ao buscar templates");
  }
};

export const getSessionWindow = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { contactId } = req.query as any;
  const { companyId } = (req as any).user;

  if (!contactId) {
    throw new AppError("contactId é obrigatório", 400);
  }

  try {
    const result = await GetSessionWindow({
      whatsappId: Number(whatsappId),
      contactId: Number(contactId),
      companyId
    });

    return res.status(200).json(result);
  } catch (err: any) {
    throw new AppError(err.message || "Erro ao verificar janela de sessão");
  }
};

export const sendTemplateToContact = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId, id: userId } = (req as any).user;
  const { contactId, queueId, templateName, languageCode } = req.body;
  const companyIdNum = Number(companyId);

  // components/variablesConfig podem chegar como string JSON em multipart
  const parseMaybeJson = (v: any) => {
    if (typeof v !== "string") return v;
    try { return JSON.parse(v); } catch { return v; }
  };
  const components = parseMaybeJson(req.body.components);
  const variablesConfig = parseMaybeJson(req.body.variablesConfig);

  if (!contactId || !templateName) {
    throw new AppError("contactId e templateName são obrigatórios", 400);
  }

  try {
    const { ticket, message } = await SendTemplateToContact({
      whatsappId: Number(whatsappId),
      contactId: Number(contactId),
      companyId: companyIdNum,
      userId: Number(userId),
      queueId: queueId ? Number(queueId) : undefined,
      templateName,
      languageCode,
      components,
      variablesConfig,
      headerMediaFile: req.file as Express.Multer.File | undefined
    });

    return res.status(200).json({ ticket, message });
  } catch (err: any) {
    throw new AppError(err.message || "Erro ao enviar template para contato");
  }
};
