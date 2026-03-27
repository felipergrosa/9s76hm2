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

const getQuickMessageFolder = (companyId: number | string): string =>
  path.resolve(__dirname, "..", "..", "public", `company${companyId}`, "quickMessage");

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

  try {
    if (!files || files.length === 0) {
      throw new AppError("Nenhum arquivo foi enviado", 400);
    }

    const quickmessage = await QuickMessage.findByPk(id);

    if (!quickmessage) {
      throw new AppError("Mensagem rápida não encontrada", 404);
    }

    let currentPaths: string[] = [];
    let currentNames: string[] = [];

    const rawPath = quickmessage.getDataValue("mediaPath");
    const rawName = quickmessage.getDataValue("mediaName");

    if (rawPath) {
      try {
        const parsed = JSON.parse(rawPath);
        currentPaths = Array.isArray(parsed) ? parsed : [rawPath];
      } catch (e) {
        currentPaths = [rawPath];
      }
    }

    if (rawName) {
      try {
        const parsed = JSON.parse(rawName);
        currentNames = Array.isArray(parsed) ? parsed : [rawName];
      } catch (e) {
        currentNames = [rawName];
      }
    }

    const newPaths = await Promise.all(files.map(async (f) => {
      if (f.mimetype.startsWith("audio/")) {
        const oggFilename = `${f.filename.split('.')[0]}.ogg`;
        const oggPath = path.resolve(f.destination, oggFilename);
        
        try {
          await new Promise((resolve, reject) => {
            const ffmpeg = require("fluent-ffmpeg");
            const ffmpegPath = require("ffmpeg-static");
            ffmpeg.setFfmpegPath(ffmpegPath);
            
            ffmpeg(f.path)
              .toFormat("ogg")
              .audioCodec("libopus")
              .on("error", (err: any) => {
                console.error("FFMPEG Error:", err);
                reject(err);
              })
              .on("end", () => {
                // Remover arquivo original após conversão
                if (fs.existsSync(f.path)) {
                  fs.unlinkSync(f.path);
                }
                resolve(true);
              })
              .save(oggPath);
          });
          return oggFilename;
        } catch (e) {
          console.error("Erro na conversão de áudio:", e);
          return f.filename; // Fallback para o original em caso de erro
        }
      }
      return f.filename;
    }));

    const newNames = files.map(f => f.originalname);

    await quickmessage.update({
      mediaPath: JSON.stringify([...currentPaths, ...newPaths]),
      mediaName: JSON.stringify([...currentNames, ...newNames])
    });

    return res.status(200).json({ 
      mensagem: "Arquivo Anexado", 
      files: newNames, 
      filenames: newPaths 
    });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};

export const deleteMedia = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { filename } = req.query; // Para excluir um arquivo específico
  const { companyId } = req.user

  try {
    const quickmessage = await QuickMessage.findByPk(id);

    if (!quickmessage) {
      throw new AppError("Mensagem rápida não encontrada", 404);
    }

    const rawPath = quickmessage.getDataValue("mediaPath");
    const rawName = quickmessage.getDataValue("mediaName");

    let currentPaths: string[] = [];
    let currentNames: string[] = [];

    if (rawPath) {
      try {
        const parsed = JSON.parse(rawPath);
        currentPaths = Array.isArray(parsed) ? parsed : [rawPath];
      } catch (e) {
        currentPaths = [rawPath];
      }
    }

    if (rawName) {
      try {
        const parsed = JSON.parse(rawName);
        currentNames = Array.isArray(parsed) ? parsed : [rawName];
      } catch (e) {
        currentNames = [rawName];
      }
    }

    if (filename) {
      // Exclui apenas um arquivo específico
      const fileIndex = currentPaths.indexOf(filename as string);
      if (fileIndex !== -1) {
        const filePath = path.resolve(getQuickMessageFolder(companyId), currentPaths[fileIndex]);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        currentPaths.splice(fileIndex, 1);
        currentNames.splice(fileIndex, 1);
      }
    } else {
      // Exclui todos
      currentPaths.forEach(file => {
        const filePath = path.resolve(getQuickMessageFolder(companyId), file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      currentPaths = [];
      currentNames = [];
    }

    await quickmessage.update({
      mediaPath: currentPaths.length > 0 ? JSON.stringify(currentPaths) : null,
      mediaName: currentNames.length > 0 ? JSON.stringify(currentNames) : null
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
