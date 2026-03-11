import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import ListService from "../services/QuickMessageService/ListService";
import CreateService from "../services/QuickMessageService/CreateService";
import ShowService from "../services/QuickMessageService/ShowService";
import UpdateService from "../services/QuickMessageService/UpdateService";
import DeleteService from "../services/QuickMessageService/DeleteService";
import FindService from "../services/QuickMessageService/FindService";

import QuickMessage from "../models/QuickMessage";
import { head } from "lodash";
import fs from "fs";
import path from "path";

import AppError from "../errors/AppError";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  userId: string | number;
  sortBy?: string;
  groupName?: string;
};

type StoreData = {
  shortcode: string;
  message: string;
  userId: number | number;
  mediaPath?: string;
  mediaName?: string;
  geral: boolean;
  isMedia: boolean;
  visao: boolean;
  groupName?: string;
  color?: string;
};

type FindParams = {
  companyId: string;
  userId: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber, sortBy, groupName } = req.query as IndexQuery;
  const { companyId, id: userId, profile } = req.user;
  const isAdmin = profile === "admin" || (req.user as any).super === true;

  const { records, count, hasMore } = await ListService({
    searchParam,
    pageNumber,
    companyId,
    userId,
    isAdmin,
    sortBy,
    groupName
  });

  return res.json({ records, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = req.body as StoreData;



  const schema = Yup.object().shape({
    shortcode: Yup.string().required(),
    message: data.isMedia ? Yup.string().notRequired() : Yup.string().required()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const record = await CreateService({
    ...data,
    companyId,
    userId: req.user.id
  });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
  .emit(`company-${companyId}-quickmessage`, {
    action: "create",
    record
  });

  return res.status(200).json(record);
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
  const { companyId } = req.user;

  const schema = Yup.object().shape({
    shortcode: Yup.string().required(),
    message: data.isMedia ? Yup.string().notRequired() : Yup.string().required()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const { id } = req.params;
  const { profile } = req.user;
  const isAdmin = profile === "admin" || (req.user as any).super === true;

  const record = await UpdateService({
    ...data,
    userId: req.user.id,
    id,
    isAdmin,
  });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
  .emit(`company-${companyId}-quickmessage`, {
    action: "update",
    record
  });

  return res.status(200).json(record);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId, profile } = req.user;
  const isAdmin = profile === "admin" || (req.user as any).super === true;

  // User padrão só pode excluir as próprias
  if (!isAdmin) {
    const record = await QuickMessage.findByPk(id);
    if (record && record.userId !== Number(req.user.id)) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  }

  await DeleteService(id);

  const io = getIO();
  io.of(`/workspace-${companyId}`)
  .emit(`company-${companyId}-quickmessage`, {
    action: "delete",
    id
  });

  return res.status(200).json({ message: "Contact deleted" });
};

export const findList = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const params = req.query as FindParams;
  const companyId = req.user.companyId.toString();
  const userId = req.user.id.toString();
  const records: QuickMessage[] = await FindService({ ...params, companyId, userId });

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
    const quickmessage = await QuickMessage.findByPk(id);
    
    await quickmessage.update ({
      mediaPath: file.filename,
      mediaName: file.originalname
    });

    return res.send({ mensagem: "Arquivo Anexado" });
    } catch (err: any) {
      throw new AppError(err.message);
  }
};

export const deleteMedia = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user

  try {
    const quickmessage = await QuickMessage.findByPk(id);
    const filePath = path.resolve("public", `company${companyId}`,"quickMessage",quickmessage.mediaName);
    const fileExists = fs.existsSync(filePath);
    if (fileExists) {
      fs.unlinkSync(filePath);
    }
    await quickmessage.update ({
      mediaPath: null,
      mediaName: null
    });

    return res.send({ mensagem: "Arquivo Excluído" });
    } catch (err: any) {
      throw new AppError(err.message);
  }
};

export const incrementUse = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;

  try {
    const record = await QuickMessage.findByPk(id);
    if (!record) {
      throw new AppError("ERR_NO_TICKETNOTE_FOUND", 404);
    }

    await record.update({
      useCount: (record.useCount || 0) + 1
    });

    return res.status(200).json(record);
  } catch (err: any) {
    throw new AppError(err.message);
  }
};
