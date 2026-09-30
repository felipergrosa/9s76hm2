import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import AppError from "../errors/AppError";
import ListService from "../services/CampaignSettingServices/ListService";
import CreateService from "../services/CampaignSettingServices/CreateService";
import UpdateServiceCampaignSettings from "../services/CampaignSettingServices/UpdateServiceCampaignSettings";
import { isArray, isObject } from "lodash";

interface StoreData {
  settings: any;
}

interface UpdateData {
  value: any;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const records = await ListService({
    companyId
  });

  return res.json(records);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = req.body as StoreData;

  const record = await CreateService(data, companyId);

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company-${companyId}-campaignSettings`, {
      action: "create",
      record
    });

  return res.status(200).json(record);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const data = req.body as UpdateData;
  const { companyId } = req.user;

  const schema = Yup.object().shape({
    value: Yup.mixed().required()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const { id } = req.params;

  // Normaliza o valor para string, mantendo padrão do CreateService
  const normalizedValue =
    isArray(data.value) || isObject(data.value)
      ? JSON.stringify(data.value)
      : data.value;

  const record = await UpdateServiceCampaignSettings({
    id,
    value: normalizedValue as any,
    companyId
  } as any);

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company-${companyId}-campaignSettings`, {
      action: "update",
      record
    });

  return res.status(200).json(record);
};

