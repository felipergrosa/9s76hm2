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
import { StartService } from "../services/CampaignService/StartService";
import CloneCampaignService from "../services/CampaignService/CloneCampaignService";
import { hasPermissionAsync } from "../modules/permissions/resolver";

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
  negativeTagListIds?: number[] | string | null;
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
  sendMediaSeparately?: boolean;  // Enviar mídia separada do texto
};

type FindParams = {
  companyId: string;
  searchParam: string;
  pageNumber: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as FindParams;
  const { companyId } = req.user;

  const { records, count, hasMore } = await ListService({
    searchParam,
    pageNumber,
    companyId
  });

  return res.json({ records, count, hasMore });
};

export const countActiveCampaigns = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const count = await Campaign.count({
    where: {
      companyId,
      status: ["EM_ANDAMENTO", "PROGRAMADA"]
    }
  });

  return res.json({ count });
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
        // N2 (IDOR): tag e contatos precisam pertencer ao tenant autenticado
        const contactTags = await ContactTag.findAll({ where: { tagId, companyId } });
        const contactIds = contactTags.map((contactTag) => contactTag.contactId);

        const contacts = await Contact.findAll({ where: { id: contactIds, companyId } });

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
  const { companyId } = req.user;

  const record = await ShowService(id, companyId);

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
    id,
    companyId // N2 (IDOR): tenant do token sobrescreve qualquer companyId do body
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
  const { companyId } = req.user;

  await CancelService(+id, companyId);

  return res.status(204).json({ message: "Cancelamento realizado" });
};

export const restart = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  await RestartService(+id, companyId);

  return res.status(204).json({ message: "Reinício dos disparos" });
};

export const start = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  const record = await StartService(+id, companyId);

  return res.status(200).json(record);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  await DeleteService(id, companyId);

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
  const { companyId } = req.user;
  const params = req.query as FindParams;

  // N2 (IDOR): ignora companyId da query — sempre o tenant do token
  const records: Campaign[] = await FindService({
    ...params,
    companyId: String(companyId)
  });

  return res.status(200).json(records);
};

export const mediaUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;
  const files = req.files as Express.Multer.File[];
  const file = head(files);

  try {
    // N2 (IDOR): só permite upload de mídia em campanha do próprio tenant
    const campaign = await Campaign.findOne({ where: { id, companyId } });
    if (!campaign || !file) {
      throw new AppError("Campanha não encontrada", 404);
    }
    campaign.mediaPath = file.filename;
    // N2: sanitiza o nome original removendo separadores de caminho
    campaign.mediaName = path.basename(file.originalname.replace(/\\/g, "/"));
    await campaign.save();
    return res.send({ mensagem: "Mensagem enviada" });
  } catch (err: any) {
    if (err instanceof AppError) throw err;
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
    // N2 (IDOR): só permite excluir mídia de campanha do próprio tenant
    const campaign = await Campaign.findOne({ where: { id, companyId } });
    if (!campaign) {
      throw new AppError("Campanha não encontrada", 404);
    }

    // N2 (path traversal): basename impede sair do diretório público do tenant
    if (campaign.mediaPath) {
      const filePath = path.resolve(
        "public",
        `company${companyId}`,
        path.basename(campaign.mediaPath)
      );
      const fileExists = fs.existsSync(filePath);
      if (fileExists) {
        fs.unlinkSync(filePath);
      }
    }

    campaign.mediaPath = null;
    campaign.mediaName = null;
    await campaign.save();
    return res.send({ mensagem: "Arquivo excluído" });
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError(err.message);
  }
};

export const detailedReport = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;
  const { status, search, pageNumber } = req.query as any;

  try {
    const report = await GetDetailedReportService(+id, companyId, {
      status,
      search,
      pageNumber
    });

    return res.status(200).json(report);
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError(err.message);
  }
};

export const campaignCost = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  try {
    const cost = await CalculateCampaignCost(+id, companyId);

    if (!cost) {
      return res.status(200).json({
        message: "Campanha não usa API Oficial. Não há custo.",
        cost: null
      });
    }

    return res.status(200).json({ cost });
  } catch (err: any) {
    if (err instanceof AppError) throw err;
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
    const record = await CloneCampaignService(id, companyId);

    const io = getIO();
    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-campaign`, {
        action: "create",
        record
      });

    return res.status(201).json(record);
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError(err.message);
  }
};

/**
 * Duplica uma campanha existente (alias de clone com param :campaignId)
 * Reutiliza CloneCampaignService — nome recebe sufixo " (cópia)"
 */
export const duplicate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { campaignId } = req.params;
  const { companyId } = req.user;

  try {
    const record = await CloneCampaignService(campaignId, companyId);

    const io = getIO();
    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-campaign`, {
        action: "create",
        record
      });

    return res.status(201).json(record);
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError(err.message);
  }
};

type BulkAction = "cancel" | "restart" | "delete";

// Permissão exigida por ação em lote (validada dentro do controller,
// pois a rota é única para as três ações)
const BULK_ACTION_PERMISSION: Record<BulkAction, string> = {
  cancel: "campaigns.edit",
  restart: "campaigns.edit",
  delete: "campaigns.delete"
};

/**
 * Ações em lote sobre campanhas: cancel | restart | delete
 * Reutiliza os services individuais — cada um já filtra por companyId,
 * então ids de outro tenant caem como erro "não encontrada".
 */
export const bulk = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { ids, action } = req.body as { ids: number[]; action: BulkAction };

  const schema = Yup.object().shape({
    ids: Yup.array().of(Yup.number().integer().positive()).min(1).required(),
    action: Yup.string().oneOf(["cancel", "restart", "delete"]).required()
  });

  try {
    await schema.validate({ ids, action });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  // N2 (autorização): valida a permissão específica da ação solicitada
  const fullUser = (req as any).fullUser;
  const requiredPermission = BULK_ACTION_PERMISSION[action];
  if (!(await hasPermissionAsync(fullUser, requiredPermission))) {
    throw new AppError(`ERR_NO_PERMISSION: ${requiredPermission}`, 403);
  }

  const errors: { id: number; error: string }[] = [];
  let processed = 0;
  const io = getIO();

  for (const id of ids) {
    try {
      if (action === "cancel") {
        await CancelService(+id, companyId);
      } else if (action === "restart") {
        await RestartService(+id, companyId);
      } else {
        await DeleteService(String(id), companyId);
        // Mesmo evento emitido pelo remove individual, para sync via socket
        io.of(`/workspace-${companyId}`)
          .emit(`company-${companyId}-campaign`, {
            action: "delete",
            id
          });
      }
      processed += 1;
    } catch (err: any) {
      errors.push({ id, error: err.message });
    }
  }

  return res.status(200).json({ processed, errors });
};
