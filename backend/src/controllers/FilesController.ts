import { Request, Response } from "express";
import { getIO } from "../libs/socket";


import { head } from "lodash";

import CreateService from "../services/FileServices/CreateService";
import ListService from "../services/FileServices/ListService";
import UpdateService from "../services/FileServices/UpdateService";
import ShowService from "../services/FileServices/ShowService";
import DeleteService from "../services/FileServices/DeleteService";
import SimpleListService from "../services/FileServices/SimpleListService";
import DeleteAllService from "../services/FileServices/DeleteAllService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import FilesOptions from "../models/FilesOptions";

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string | number;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { pageNumber, searchParam } = req.query as IndexQuery;
  const { companyId } = req.user;

  const { files, count, hasMore } = await ListService({
    searchParam,
    pageNumber,
    companyId
  });

  return res.json({ files, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, message } = req.body;
  const { companyId } = req.user;
  const files = req.files as Express.Multer.File[];

  const options = files?.map((file, index) => ({
    name: req.body[`option_${index}_name`],
    path: file.filename,
    mediaType: file.mimetype,
  })) || [];

  const fileList = await CreateService({
    name,
    message,
    options,
    companyId
  });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company${companyId}-file`, {
      action: "create",
      fileList
    });

  return res.status(200).json(fileList);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { fileId } = req.params;
  const { companyId } = req.user;

  const file = await ShowService(fileId, companyId);

  return res.status(200).json(file);
};


export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  // Autorização feita na rota via checkPermission("files.upload").
  const { fileId } = req.params;
  const { companyId } = req.user;
  const files = req.files as Express.Multer.File[];
  const fileData = req.body;

  // Reconstrói options preservando ordem e associação correta
  const optionsMap = new Map();
  let fileIndex = 0;
  
  // Primeiro, coleta todas as options do FormData
  for (const key in req.body) {
    if (key.startsWith('option_')) {
      const parts = key.split('_');
      const index = parseInt(parts[1], 10);
      const property = parts[2];

      if (!optionsMap.has(index)) {
        optionsMap.set(index, {});
      }

      const option = optionsMap.get(index);
      if (property === 'id') {
        option.id = parseInt(req.body[key], 10);
      } else if (property === 'name') {
        option.name = req.body[key];
      } else if (property === 'file_index') {
        option.fileIndex = parseInt(req.body[key], 10);
      }
    }
  }

  // Associa arquivos novos usando file_index se disponível
  files?.forEach((file, idx) => {
    // Procura por option que referencia este arquivo
    for (const [optionIndex, option] of optionsMap.entries()) {
      if (option.fileIndex === idx || (!option.id && !option.path && fileIndex === idx)) {
        option.path = file.filename;
        option.mediaType = file.mimetype;
        delete option.fileIndex; // Remove campo auxiliar
        break;
      }
    }
    fileIndex++;
  });

  // Converte Map para array ordenado
  const options = Array.from(optionsMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, option]) => option)
    .filter(opt => opt.name || opt.id); // Remove entradas vazias

  fileData.options = options;

  const fileList = await UpdateService({ fileData, id: fileId, companyId });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
  .emit(`company${companyId}-file`, {
    action: "update",
    fileList
  });

  return res.status(200).json(fileList);
};


export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { fileId } = req.params;
  const { companyId } = req.user;

  await DeleteService(fileId, companyId);

  const io = getIO();
  io.of(`/workspace-${companyId}`)
  .emit(`company${companyId}-file`, {
    action: "delete",
    fileId
  });

  return res.status(200).json({ message: "File List deleted" });
};

export const removeAll = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  await DeleteAllService(companyId);

  return res.send();
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam } = req.query as IndexQuery;
  const { companyId } = req.user;

  const ratings = await SimpleListService({ searchParam, companyId });

  return res.json(ratings);
};
