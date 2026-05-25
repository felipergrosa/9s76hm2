import { Request, Response } from "express";

import { getIO } from "../libs/socket";
import AppError from "../errors/AppError";

import UpdateSettingService from "../services/SettingServices/UpdateSettingService";
import ListSettingsService from "../services/SettingServices/ListSettingsService";
import ListSettingsServiceOne from "../services/SettingServices/ListSettingsServiceOne";
import GetSettingService from "../services/SettingServices/GetSettingService";
import UpdateOneSettingService from "../services/SettingServices/UpdateOneSettingService";
import GetPublicSettingService from "../services/SettingServices/GetPublicSettingService";
import { getActiveSavedFilterCronConfig, rescheduleSavedFilterCron, updateCronSettingsAndReschedule } from "../jobs/SavedFilterCronManager";

type LogoRequest = {
  mode: string;
};

// ===== SavedFilter Cron Config (helpers para frontend) =====
export const getSavedFilterCronConfig = async (req: Request, res: Response): Promise<Response> => {
  const cfg = getActiveSavedFilterCronConfig();
  return res.status(200).json(cfg);
};

export const updateSavedFilterCronConfig = async (req: Request, res: Response): Promise<Response> => {
  const { expr, tz } = req.body as { expr: string; tz: string };
  if (!expr || !tz) {
    return res.status(400).json({ error: "'expr' e 'tz' são obrigatórios" });
  }
  await updateCronSettingsAndReschedule(expr, tz);
  const cfg = getActiveSavedFilterCronConfig();
  return res.status(200).json(cfg);
};

type PrivateFileRequest = {
  settingKey: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  // if (req.user.profile !== "admin") {
  //   throw new AppError("ERR_NO_PERMISSION", 403);
  // }

  const settings = await ListSettingsService({ companyId });

  return res.status(200).json(settings);
};

export const showOne = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { settingKey: key } = req.params;

  console.log("|======== GetPublicSettingService ========|")
  console.log("key", key)
  console.log("|=========================================|")

  
  const settingsTransfTicket = await ListSettingsServiceOne({ companyId: companyId, key: key });

  return res.status(200).json(settingsTransfTicket);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {

  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { settingKey: key } = req.params;
  const { value } = req.body;
  const { companyId } = req.user;

  // Validação: impedir atualização sem 'value'
  if (value === undefined || value === null) {
    return res.status(400).json({ error: "'value' é obrigatório" });
  }

  const setting = await UpdateSettingService({
    key,
    value,
    companyId
  });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
  .emit(`company-${companyId}-settings`, {
    action: "update",
    setting
  });

  return res.status(200).json(setting);
};

export const getSetting = async (
  req: Request,
  res: Response): Promise<Response> => {

  const { settingKey: key } = req.params;

  const setting = await GetSettingService({ key });

  return res.status(200).json(setting);

}

export const updateOne = async (
  req: Request,
  res: Response
): Promise<Response> => {

  const { settingKey: key } = req.params;
  const { value } = req.body;

  // Validação: impedir atualização sem 'value'
  if (value === undefined || value === null) {
    return res.status(400).json({ error: "'value' é obrigatório" });
  }

  const setting = await UpdateOneSettingService({
    key,
    value
  });

  // Se for configuração do cron de savedFilter, re-agenda com base nas configs atuais
  if (key === "SAVED_FILTER_CRON" || key === "SAVED_FILTER_TZ") {
    await rescheduleSavedFilterCron();
  }

  return res.status(200).json(setting); 
};

export const publicShow = async (req: Request, res: Response): Promise<Response> => {
  const { settingKey: key } = req.params;
  
  const settingValue = await GetPublicSettingService({ key });


  return res.status(200).json(settingValue);
};

export const storeLogo = async (req: Request, res: Response): Promise<Response> => {
  const file = req.file as Express.Multer.File;
  const { mode }: LogoRequest = req.body;
  const { companyId } = req.user;
  const validModes = [ "Light", "Dark", "Favicon" ];

  console.log("|=============== storeLogo  ==============|", storeLogo)

  if ( validModes.indexOf(mode) === -1 ) {
    return res.status(406);
  }

  if (file && file.mimetype.startsWith("image/")) {
    
    const setting = await UpdateSettingService({
      key: `appLogo${mode}`,
      value: file.filename,
      companyId
    });
    
    return res.status(200).json(setting.value);
  }
  
  return res.status(406);
}

export const storePrivateFile = async (req: Request, res: Response): Promise<Response> => {
  const file = req.file as Express.Multer.File;
  const { settingKey }: PrivateFileRequest = req.body;
  const { companyId } = req.user;


  console.log("|=============== storePrivateFile  ==============|", storeLogo)

  const setting = await UpdateSettingService({
    key: `_${settingKey}`,
    value: file.filename,
    companyId
  });
  
  return res.status(200).json(setting.value);
}
