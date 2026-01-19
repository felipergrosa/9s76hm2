import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { head } from "lodash";
import fs from "fs";
import path from "path";

import ListService from "../services/CampaignService/ListService";
import CreateService from "../services/CampaignService/CreateService";
import ShowService from "../services/CampaignService/ShowService";
import UpdateService from "../services/CampaignService/UpdateService";
import DeleteService from "../services/CampaignService/DeleteService";
import FindService from "../services/CampaignService/FindService";
import GetDetailedReportService from "../services/CampaignService/GetDetailedReportService";
import { CalculateCampaignCost, CalculateMonthlyCost } from "../services/CampaignService/CalculateCostService";

import Campaign from "../models/Campaign";

import ContactTag from "../models/ContactTag";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import ContactList from "../models/ContactList";
import ContactListItem from "../models/ContactListItem";

import AppError from "../errors/AppError";
import { CancelService } from "../services/CampaignService/CancelService";
import { RestartService } from "../services/CampaignService/RestartService";
import CloneCampaignService from "../services/CampaignService/CloneCampaignService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  companyId: string | number;
};

type StoreData = {
  name: string;
  status: string;
  confirmation: boolean;
  scheduledAt: string;
  companyId: number;
  contactListId: number;
  tagListId: number | string;
  userId: number | string;
  queueId: number | string;
  statusTicket: string;
  openTicket: string;
  dispatchStrategy?: string; // 'single' | 'round_robin'
  allowedWhatsappIds?: number[] | string | null;
  // Mídia por mensagem (1..5)
  mediaUrl1?: string | null;
  mediaName1?: string | null;
  mediaUrl2?: string | null;
  mediaName2?: string | null;
  mediaUrl3?: string | null;
  mediaName3?: string | null;
  mediaUrl4?: string | null;
  mediaName4?: string | null;
  mediaUrl5?: string | null;
  mediaName5?: string | null;
  metaTemplateName?: string | null;
  metaTemplateLanguage?: string | null;
  metaTemplateVariables?: Record<string, any> | null;  // Mapeamento de variáveis do template
};

type FindParams = {
  companyId: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;
  const { companyId } = req.user;

  const { records, count, hasMore } = await ListService({
    searchParam,
    pageNumber,
    companyId
  });

  return res.json({ records, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = req.body as StoreData;

  const schema = Yup.object().shape({
    name: Yup.string().required()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  if (typeof data.tagListId === 'number') {

    const tagId = data.tagListId;
    const campanhaNome = data.name;

    async function createContactListFromTag(tagId) {

      const currentDate = new Date();
      const formattedDate = currentDate.toISOString();

      try {
        const contactTags = await ContactTag.findAll({ where: { tagId } });
        const contactIds = contactTags.map((contactTag) => contactTag.contactId);

        const contacts = await Contact.findAll({ where: { id: contactIds } });

        const randomName = `${campanhaNome} | TAG: ${tagId} - ${formattedDate}` // Implement your own function to generate a random name
        const contactList = await ContactList.create({ name: randomName, companyId: companyId });

        const { id: contactListId } = contactList;

        const contactListItems = contacts.map((contact) => ({
          name: contact.name,
          number: contact.number,
          email: contact.email,
          contactListId,
          companyId,
          isWhatsappValid: true,
          isGroup: contact.isGroup

        }));

        await ContactListItem.bulkCreate(contactListItems);

        // Return the ContactList ID
        return contactListId;
      } catch (error) {
        console.error('Error creating contact list:', error);
        throw error;
      }
    }


    createContactListFromTag(tagId)
      .then(async (contactListId) => {
        const record = await CreateService({
          ...data,
          companyId,
          contactListId: contactListId,
        });
        const io = getIO();
        io.of(`/workspace-${companyId}`)
          .emit(`company-${companyId}-campaign`, {
            action: "create",
            record
          });
        return res.status(200).json(record);
      })
      .catch((error) => {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Error creating contact list' });
      });

  } else { // SAI DO CHECK DE TAG


    const record = await CreateService({
      ...data,
      companyId
    });

    const io = getIO();
    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-campaign`, {
        action: "create",
        record
      });

    return res.status(200).json(record);
  }
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;

  const record = await ShowService(id);

  return res.status(200).json(record);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const data = req.body as StoreData;

  // DEBUG: Log para verificar se metaTemplateVariables está chegando
  console.log('[CampaignController.update] metaTemplateVariables recebido:', JSON.stringify(data.metaTemplateVariables));

  const { companyId } = req.user;

  const schema = Yup.object().shape({
    name: Yup.string().required()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const { id } = req.params;

  const record = await UpdateService({
    ...data,
    id
  });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company-${companyId}-campaign`, {
      action: "update",
      record
    });

  return res.status(200).json(record);
};

export const cancel = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;

  await CancelService(+id);

  return res.status(204).json({ message: "Cancelamento realizado" });
};

export const restart = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;

  await RestartService(+id);

  return res.status(204).json({ message: "Reinício dos disparos" });
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  await DeleteService(id);

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company-${companyId}-campaign`, {
      action: "delete",
      id
    });

  return res.status(200).json({ message: "Campaign deleted" });
};

export const findList = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const params = req.query as FindParams;
  const records: Campaign[] = await FindService(params);

  return res.status(200).json(records);
};

export const mediaUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const files = req.files as Express.Multer.File[];
  const file = head(files);

  try {
    const campaign = await Campaign.findByPk(id);
    campaign.mediaPath = file.filename;
    campaign.mediaName = file.originalname;
    await campaign.save();
    return res.send({ mensagem: "Mensagem enviada" });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};

export const deleteMedia = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  try {
    const campaign = await Campaign.findByPk(id);
    const filePath = path.resolve("public", `company${companyId}`, campaign.mediaPath);
    const fileExists = fs.existsSync(filePath);
    if (fileExists) {
      fs.unlinkSync(filePath);
    }

    campaign.mediaPath = null;
    campaign.mediaName = null;
    await campaign.save();
    return res.send({ mensagem: "Arquivo excluído" });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};

export const detailedReport = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { status, search, pageNumber } = req.query as any;

  try {
    const report = await GetDetailedReportService(+id, {
      status,
      search,
      pageNumber
    });

    return res.status(200).json(report);
  } catch (err: any) {
    throw new AppError(err.message);
  }
};

export const campaignCost = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;

  try {
    const cost = await CalculateCampaignCost(+id);

    if (!cost) {
      return res.status(200).json({
        message: "Campanha não usa API Oficial. Não há custo.",
        cost: null
      });
    }

    return res.status(200).json({ cost });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};

export const monthlyCost = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { month } = req.query as any; // YYYY-MM
  const { companyId } = (req as any).user;

  try {
    const report = await CalculateMonthlyCost(companyId, month);
    return res.status(200).json(report);
  } catch (err: any) {
    throw new AppError(err.message);
  }
};

/**
 * Clona uma campanha existente
 */
export const clone = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  try {
    const record = await CloneCampaignService(id);

    const io = getIO();
    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-campaign`, {
        action: "create",
        record
      });

    return res.status(201).json(record);
  } catch (err: any) {
    throw new AppError(err.message);
  }
};