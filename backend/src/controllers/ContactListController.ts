import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { emitToCompanyNamespace } from "../libs/socketEmit";

import ListService from "../services/ContactListService/ListService";
import CreateService from "../services/ContactListService/CreateService";
import ShowService from "../services/ContactListService/ShowService";
import UpdateService from "../services/ContactListService/UpdateService";
import DeleteService from "../services/ContactListService/DeleteService";
import FindService from "../services/ContactListService/FindService";
import SyncContactListBySavedFilterService from "../services/ContactListService/SyncContactListBySavedFilterService";
import { head } from "lodash";

import ContactList from "../models/ContactList";
import ContactListItem from "../models/ContactListItem";

import AppError from "../errors/AppError";
import { ImportContacts } from "../services/ContactListService/ImportContacts";
import { validateWhatsappContactsQueue } from "../queues";
import logger from "../utils/logger";
import FixUnlinkedContactsService from "../services/ContactListItemService/FixUnlinkedContactsService";


type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  companyId: string | number;
};

type StoreData = {
  name: string;
  companyId?: string | number;
};

type UpdateData = {
  name?: string;
  savedFilter?: any | null;
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

  const record = await CreateService({
    ...data,
    companyId
  });

  const io = getIO();
  await emitToCompanyNamespace(
    companyId,
    `company-${companyId}-ContactList`,
    {
      action: "create",
      record
    }
  );

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
  const data = req.body as UpdateData;
  const { companyId } = req.user;

  const schema = Yup.object().shape({
    name: Yup.string().optional(),
    savedFilter: Yup.mixed().nullable().optional()
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
  await emitToCompanyNamespace(
    companyId,
    `company-${companyId}-ContactList`,
    {
      action: "update",
      record
    }
  );

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
  await emitToCompanyNamespace(
    companyId,
    `company-${companyId}-ContactList`,
    {
      action: "delete",
      id
    }
  );

  return res.status(200).json({ message: "Contact list deleted" });
};

export const syncNow = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  const result = await SyncContactListBySavedFilterService({
    contactListId: Number(id),
    companyId: Number(companyId)
  });

  return res.status(200).json(result);
};

export const findList = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const params = req.query as FindParams;
  const records: ContactList[] = await FindService(params);

  return res.status(200).json(records);
};

export const upload = async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  const file: Express.Multer.File = head(files) as Express.Multer.File;
  const { id } = req.params;
  const { companyId } = req.user;

  const response = await ImportContacts(+id, companyId, file);

  const io = getIO();
  await emitToCompanyNamespace(
    companyId,
    `company-${companyId}-ContactListItem-${+id}`,
    {
      action: "reload",
      records: response
    }
  );

  return res.status(200).json(response);
};

export const clearItems = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  await ContactListItem.destroy({
    where: { contactListId: Number(id), companyId: Number(companyId) }
  });

  const io = getIO();
  await emitToCompanyNamespace(
    companyId,
    `company-${companyId}-ContactListItem`,
    {
      action: "reload"
    }
  );
  // Emitir também no canal específico da lista para compatibilidade com outras operações
  await emitToCompanyNamespace(
    companyId,
    `company-${companyId}-ContactListItem-${Number(id)}`,
    {
      action: "reload"
    }
  );

  return res.status(200).json({ message: "Contact list items cleared" });
};

/**
 * Dispara validação de números WhatsApp para uma lista de contatos
 * Usa API oficial da Meta se disponível, senão Baileys
 */
export const validateNumbers = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;
  const { useOfficialApi, batchSize = 50 } = req.body;

  try {
    // Verificar se a lista existe
    const contactList = await ContactList.findOne({
      where: { id: Number(id), companyId: Number(companyId) }
    });

    if (!contactList) {
      throw new AppError("Lista de contatos não encontrada", 404);
    }

    // Contar contatos pendentes de validação
    const pendingCount = await ContactListItem.count({
      where: {
        contactListId: Number(id),
        companyId: Number(companyId),
        isWhatsappValid: null
      }
    });

    if (pendingCount === 0) {
      return res.status(200).json({
        message: "Nenhum contato pendente de validação",
        pendingCount: 0
      });
    }

    logger.info(`[ValidateNumbers] Iniciando validação de ${pendingCount} contatos da lista ${id}`);

    // Adicionar job na fila de validação
    await validateWhatsappContactsQueue.add(
      "validateWhatsappContacts",
      {
        contactListId: Number(id),
        companyId: Number(companyId),
        batchSize: Number(batchSize),
        useOfficialApi
      },
      {
        removeOnComplete: 10,
        removeOnFail: 5
      }
    );

    return res.status(200).json({
      message: `Validação iniciada para ${pendingCount} contatos`,
      pendingCount,
      batchSize
    });

  } catch (error: any) {
    logger.error(`[ValidateNumbers] Erro: ${error.message}`);
    throw new AppError(error.message || "Erro ao iniciar validação", 500);
  }
};

/**
 * Retorna estatísticas de validação de uma lista
 */
export const validationStats = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  try {
    const [total, valid, invalid, pending] = await Promise.all([
      ContactListItem.count({
        where: { contactListId: Number(id), companyId: Number(companyId) }
      }),
      ContactListItem.count({
        where: { contactListId: Number(id), companyId: Number(companyId), isWhatsappValid: true }
      }),
      ContactListItem.count({
        where: { contactListId: Number(id), companyId: Number(companyId), isWhatsappValid: false }
      }),
      ContactListItem.count({
        where: { contactListId: Number(id), companyId: Number(companyId), isWhatsappValid: null }
      })
    ]);

    return res.status(200).json({
      total,
      valid,
      invalid,
      pending,
      validPercentage: total > 0 ? Math.round((valid / total) * 100) : 0,
      invalidPercentage: total > 0 ? Math.round((invalid / total) * 100) : 0,
      pendingPercentage: total > 0 ? Math.round((pending / total) * 100) : 0
    });

  } catch (error: any) {
    logger.error(`[ValidationStats] Erro: ${error.message}`);
    throw new AppError(error.message || "Erro ao buscar estatísticas", 500);
  }
};

/**
 * Corrige vínculos de contatos não vinculados em uma lista
 * Atualiza o canonicalNumber dos itens para corresponder ao Contact existente
 */
export const fixLinks = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  try {
    logger.info(`[FixLinks] Iniciando correção de vínculos para lista ${id}`);

    const result = await FixUnlinkedContactsService({
      contactListId: Number(id),
      companyId: Number(companyId)
    });

    // Emitir evento para atualizar frontend
    const io = getIO();
    await emitToCompanyNamespace(
      companyId,
      `company-${companyId}-ContactListItem-${Number(id)}`,
      { action: "reload" }
    );

    return res.status(200).json({
      message: `${result.fixed} vínculos corrigidos, ${result.stillUnlinked} ainda sem vínculo`,
      ...result
    });

  } catch (error: any) {
    logger.error(`[FixLinks] Erro: ${error.message}`);
    throw new AppError(error.message || "Erro ao corrigir vínculos", 500);
  }
};

