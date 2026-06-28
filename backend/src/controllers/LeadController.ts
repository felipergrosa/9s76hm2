import { Request, Response } from "express";
import ImportLeadsService from "../services/ContactServices/ImportLeadsService";

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

  return res.status(200).json(result);
};
