import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import ListService from "../services/ContactListItemService/ListService";
import CreateService from "../services/ContactListItemService/CreateService";
import ShowService from "../services/ContactListItemService/ShowService";
import UpdateService from "../services/ContactListItemService/UpdateService";
import DeleteService from "../services/ContactListItemService/DeleteService";
import FindService from "../services/ContactListItemService/FindService";
import AddFilteredContactsToListService from "../services/ContactListItemService/AddFilteredContactsToListService";
import ContactList from "../models/ContactList";

import ContactListItem from "../models/ContactListItem";
import logger from "../utils/logger";

import AppError from "../errors/AppError";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  companyId: string | number;
  contactListId: string | number;
  orderBy?: string;
  order?: "asc" | "desc" | "ASC" | "DESC";
};

type StoreData = {
  name: string;
  number: string;
  contactListId: number;
  companyId?: string;
  email?: string;
};

type FindParams = {
  companyId: number;
  contactListId: number;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber, contactListId, orderBy, order } = req.query as IndexQuery;
  const { companyId } = req.user;

  const { contacts, count, hasMore } = await ListService({
    searchParam,
    pageNumber,
    companyId,
    contactListId,
    orderBy,
    order
  });

  return res.json({ contacts, count, hasMore });
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

  const record = await CreateService({
    ...data,
    companyId
  });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company-${companyId}-ContactListItem`, {
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
    .emit(`company-${companyId}-ContactListItem`, {
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
  const { companyId } = req.user;

  await DeleteService(id);

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company-${companyId}-ContactListItem`, {
      action: "delete",
      id
    });

  return res.status(200).json({ message: "Contact deleted" });
};

export const findList = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const params = req.query as unknown as FindParams;

  const records = await FindService({
    companyId,
    ...params
  });

  return res.status(200).json(records);
};

export const addFilteredContacts = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const { contactListId } = req.params;
    const { filters, saveFilter } = req.body as { filters: any; saveFilter?: boolean };

    logger.info('Recebendo requisição para adicionar contatos filtrados', {
      contactListId,
      filters: JSON.stringify(filters, null, 2)
    });

    // Validar tags como números
    if (filters.tags && Array.isArray(filters.tags)) {
      filters.tags = filters.tags
        .map(tag => typeof tag === 'string' ? parseInt(tag, 10) : tag)
        .filter(tag => !isNaN(tag));
      
      logger.info(`Tags convertidas para números: ${filters.tags.join(', ')}`);
    }

    const result = await AddFilteredContactsToListService({
      contactListId: parseInt(contactListId, 10),
      companyId,
      filters
    });

    // Opcionalmente salvar o filtro na lista para sincronização futura
    if (saveFilter) {
      try {
        const list = await ContactList.findByPk(parseInt(contactListId, 10));
        if (list) {
          list.set("savedFilter", filters);
          await list.save();
        }
      } catch (err: any) {
        logger.warn("Falha ao salvar savedFilter na lista", {
          contactListId,
          error: err.message
        });
      }
    }

    // Após inserir, busca a primeira página da lista para enviar via socket
    const { contacts } = await ListService({
      searchParam: "",
      pageNumber: "1",
      companyId,
      contactListId: parseInt(contactListId, 10)
    });

    const io = getIO();
    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-ContactListItem`, {
        action: "reload",
        records: contacts
      });

    return res.status(200).json(result);
  } catch (error: any) {
    const listId = req.params.contactListId;
    const requestFilters = req.body.filters;
    
    logger.error('Erro ao adicionar contatos filtrados:', {
      message: error.message,
      stack: error.stack,
      contactListId: listId,
      filters: requestFilters ? JSON.stringify(requestFilters, null, 2) : 'undefined'
    });
    return res.status(400).json({ error: error.message });
  }
};
