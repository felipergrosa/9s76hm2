import { Request, Response } from "express";
import GetApprovedTemplates from "../services/MetaServices/GetApprovedTemplates";
import AppError from "../errors/AppError";

export const getTemplates = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = (req as any).user;

  try {
    const templates = await GetApprovedTemplates({
      whatsappId: Number(whatsappId),
      companyId
    });

    return res.status(200).json({ templates });
  } catch (err: any) {
    throw new AppError(err.message || "Erro ao buscar templates");
  }
};
